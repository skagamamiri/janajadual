/* ============================================================
   Jana Jadual — enjin penjana jadual waktu (ICT HUB)
   Boleh digunakan dalam pelayar (window.TTEngine) dan Node (require).
   1 slot = minitSlot minit (lalai 30 minit = 1 masa).
   ============================================================ */
(function (root) {
  "use strict";

  const HARI_LALAI = ["ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT"];

  /* ---------- utiliti masa ---------- */
  function toMin(t) { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); }
  function toHHMM(m) { const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
  function uid(p) { return (p || "x") + Math.random().toString(36).slice(2, 9); }

  /* ---------- tetapan lalai (ikut struktur SK Agama (MIS) Miri) ---------- */
  function tetapanLalai() {
    const tamat = (a, b) => ({ ISNIN: a, SELASA: a, RABU: a, KHAMIS: a, JUMAAT: b });
    return {
      hari: HARI_LALAI.slice(),
      mulaGrid: "07:00",
      tamatGrid: "13:00",
      minitSlot: 30,
      tahap: [
        { id: "T1", nama: "Tahap 1", tahun: [1, 2, 3], tamat: tamat("12:30", "11:00"), rehat: [{ mula: "09:00", tamat: "09:30" }] },
        { id: "T2", nama: "Tahap 2", tahun: [4, 5, 6], tamat: tamat("13:00", "11:30"), rehat: [{ mula: "09:30", tamat: "10:00" }] }
      ],
      acara: [
        { id: "a1", nama: "KEROHANIAN", hari: HARI_LALAI.slice(), mula: "06:30", tamat: "07:00", tahap: ["T1", "T2"], guru: "" },
        { id: "a2", nama: "PHM", hari: ["JUMAAT"], mula: "07:00", tamat: "07:30", tahap: ["T1", "T2"], guru: "Perhimpunan" }
      ],
      maksBlokSehari: 1,          // blok subjek sama bagi satu kelas sehari
      maksBerturutGuru: 4,        // masa berturut-turut guru (lembut)
      subjekPagi: ["BM", "BI", "MT", "SN"], // utamakan waktu pagi (lembut)
      lelaran: 60000
    };
  }

  function projekKosong(nama) {
    return { versi: 1, nama: nama || "Jadual Baharu", tetapan: tetapanLalai(), guru: [], kelas: [], subjek: [], bilik: [], pelajaran: [], kad: [] };
  }

  /* ---------- grid ---------- */
  function bilSlot(t) { return Math.max(0, Math.round((toMin(t.tamatGrid) - toMin(t.mulaGrid)) / t.minitSlot)); }
  function masaSlot(t, i) { return toHHMM(toMin(t.mulaGrid) + i * t.minitSlot); }
  function tahapKelas(t, k) {
    const y = Number(k.tahun);
    return t.tahap.find(x => (x.tahun || []).map(Number).includes(y)) || t.tahap[0];
  }

  /* Matriks kebolehsediaan kelas: avail[hari][slot] = true jika boleh diisi pelajaran */
  function availKelas(t, k) {
    const S = bilSlot(t), g0 = toMin(t.mulaGrid), ms = t.minitSlot, th = tahapKelas(t, k);
    return t.hari.map(h => {
      const row = [];
      const end = toMin((th && th.tamat && th.tamat[h]) || t.tamatGrid);
      for (let s = 0; s < S; s++) {
        const a = g0 + s * ms, b = a + ms;
        let ok = b <= end;
        if (ok && th) for (const r of th.rehat || []) if (a < toMin(r.tamat) && b > toMin(r.mula)) ok = false;
        if (ok) for (const e of t.acara || []) {
          if (!(e.hari || []).includes(h)) continue;
          if (e.tahap && e.tahap.length && th && !e.tahap.includes(th.id)) continue;
          if (a < toMin(e.tamat) && b > toMin(e.mula)) ok = false;
        }
        row.push(ok);
      }
      return row;
    });
  }

  /* ---------- kad (blok pelajaran) ---------- */
  function pecahanLalai(masa) {
    masa = Math.max(0, Math.round(masa));
    const out = [];
    while (masa >= 2) { out.push(2); masa -= 2; }
    if (masa) out.push(1);
    return out;
  }
  function pecahanSah(p) {
    if (!p.pecahan || !p.pecahan.length) return pecahanLalai(p.masa);
    const sum = p.pecahan.reduce((a, b) => a + b, 0);
    return sum === Number(p.masa) ? p.pecahan.slice() : pecahanLalai(p.masa);
  }

  /* Selaraskan senarai kad dengan pelajaran: kekalkan kad sedia ada yang padan panjang */
  function selaraskanKad(P) {
    const lama = {};
    for (const c of P.kad || []) (lama[c.pel] = lama[c.pel] || []).push(c);
    const baru = [];
    for (const p of P.pelajaran) {
      const ada = (lama[p.id] || []).slice();
      for (const len of pecahanSah(p)) {
        const i = ada.findIndex(c => c.len === len);
        if (i >= 0) baru.push(ada.splice(i, 1)[0]);
        else baru.push({ id: uid("k"), pel: p.id, len, hari: -1, slot: -1, kunci: false });
      }
    }
    P.kad = baru;
    return P;
  }

  /* ---------- keadaan (occupancy) ---------- */
  function binaKeadaan(P) {
    const t = P.tetapan, D = t.hari.length, S = bilSlot(t);
    const grid = () => Array.from({ length: D }, () => new Array(S).fill(null));
    const st = {
      P, D, S,
      pel: Object.fromEntries(P.pelajaran.map(p => [p.id, p])),
      guru: Object.fromEntries(P.guru.map(g => [g.id, g])),
      kad: Object.fromEntries(P.kad.map(c => [c.id, c])),
      avail: {}, kelasOcc: {}, guruOcc: {}, bilikOcc: {}, tiada: {}, harian: {}, kadPel: {}, had: {}
    };
    for (const c of P.kad) (st.kadPel[c.pel] = st.kadPel[c.pel] || []).push(c);
    for (const p of P.pelajaran) st.had[p.id] = Number(p.maksSehari) > 0 ? Number(p.maksSehari) : Math.max(t.maksBlokSehari || 1, Math.ceil((st.kadPel[p.id] || []).length / D));
    for (const k of P.kelas) { st.avail[k.id] = availKelas(t, k); st.kelasOcc[k.id] = grid(); }
    for (const g of P.guru) {
      st.guruOcc[g.id] = grid();
      const td = grid();
      for (const key of g.tiada || []) { const [h, s] = key.split("|"); const d = t.hari.indexOf(h); if (d >= 0 && td[d]) td[d][+s] = true; }
      st.tiada[g.id] = td;
    }
    for (const b of P.bilik) st.bilikOcc[b.id] = grid();
    for (const c of P.kad) if (c.hari >= 0) pasang(st, c, c.hari, c.slot, true);
    return st;
  }

  function harianKey(c, d) { return c.pel + "|" + d; }

  function pasang(st, c, d, s, paksa) {
    const p = st.pel[c.pel]; if (!p) return;
    c.hari = d; c.slot = s;
    for (let k = 0; k < c.len; k++) {
      const x = s + k; if (x >= st.S) continue;
      if (st.kelasOcc[p.kelas]) st.kelasOcc[p.kelas][d][x] = c.id;
      for (const g of p.guru) if (st.guruOcc[g]) st.guruOcc[g][d][x] = c.id;
      if (p.bilik && st.bilikOcc[p.bilik]) st.bilikOcc[p.bilik][d][x] = c.id;
    }
    const hk = harianKey(c, d); st.harian[hk] = (st.harian[hk] || 0) + 1;
  }

  function cabut(st, c) {
    if (c.hari < 0) return;
    const p = st.pel[c.pel], d = c.hari, s = c.slot;
    if (p) for (let k = 0; k < c.len; k++) {
      const x = s + k; if (x >= st.S) continue;
      const lepas = (g) => { if (g && g[d][x] === c.id) g[d][x] = null; };
      lepas(st.kelasOcc[p.kelas]);
      for (const g of p.guru) lepas(st.guruOcc[g]);
      if (p.bilik) lepas(st.bilikOcc[p.bilik]);
    }
    const hk = harianKey(c, d); st.harian[hk] = Math.max(0, (st.harian[hk] || 1) - 1);
    c.hari = -1; c.slot = -1;
  }

  function hadSehari(st, p) { return st.had[p.id] || 1; }

  /* Struktur: adakah blok boleh berada di (d,s) jika semua kad lain diabaikan? */
  function strukturOK(st, c, d, s) {
    const p = st.pel[c.pel]; if (!p) return false;
    const av = st.avail[p.kelas]; if (!av) return false;
    for (let k = 0; k < c.len; k++) {
      const x = s + k;
      if (x >= st.S || !av[d][x]) return false;
      for (const g of p.guru) if (st.tiada[g] && st.tiada[g][d][x]) return false;
    }
    return true;
  }

  /* Senarai kad yang bertembung jika c diletak di (d,s). null = mustahil secara struktur. */
  function pertembungan(st, c, d, s) {
    if (!strukturOK(st, c, d, s)) return null;
    const p = st.pel[c.pel], set = new Set();
    for (let k = 0; k < c.len; k++) {
      const x = s + k;
      const a = st.kelasOcc[p.kelas][d][x]; if (a && a !== c.id) set.add(a);
      for (const g of p.guru) { const b = st.guruOcc[g] && st.guruOcc[g][d][x]; if (b && b !== c.id) set.add(b); }
      if (p.bilik && st.bilikOcc[p.bilik]) { const r = st.bilikOcc[p.bilik][d][x]; if (r && r !== c.id) set.add(r); }
    }
    // had blok sehari bagi pelajaran sama
    const lim = hadSehari(st, p);
    const sama = (st.kadPel[c.pel] || []).filter(o => o.pel === c.pel && o.id !== c.id && o.hari === d && !set.has(o.id));
    if (sama.length >= lim) {
      // perlu keluarkan satu (yang tidak berkunci jika boleh)
      const buang = sama.find(o => !o.kunci) || sama[0];
      set.add(buang.id);
    }
    return [...set];
  }

  /* Skor lembut (lebih kecil lebih baik) */
  function skorLembut(st, c, d, s) {
    const t = st.P.tetapan, p = st.pel[c.pel];
    const sub = (st.P.subjek.find(x => x.id === p.subjek) || {}).kod || "";
    let sc = 0;
    if ((t.subjekPagi || []).includes(sub)) sc += s * 0.6;
    for (const g of p.guru) {
      const occ = st.guruOcc[g]; if (!occ) continue;
      let beban = 0; for (const x of occ[d]) if (x) beban++;
      sc += beban * 0.35;
      // masa berturut-turut
      let run = c.len, x = s - 1; while (x >= 0 && occ[d][x]) { run++; x--; }
      x = s + c.len; while (x < st.S && occ[d][x]) { run++; x++; }
      if (run > (t.maksBerturutGuru || 99)) sc += 6 * (run - t.maksBerturutGuru);
    }
    // sebarkan blok pelajaran sama ke hari berlainan
    sc += (st.harian[harianKey(c, d)] || 0) * 4;
    return sc;
  }

  function semuaKedudukan(st, c) {
    const out = [];
    for (let d = 0; d < st.D; d++) for (let s = 0; s + c.len <= st.S; s++) out.push([d, s]);
    return out;
  }

  /* ---------- penjana ---------- */
  function Penjana(P, opsyen) {
    opsyen = opsyen || {};
    selaraskanKad(P);
    const st = binaKeadaan(P);
    const kad = P.kad;
    // kosongkan kad tidak berkunci (kecuali opsyen.teruskan)
    if (!opsyen.teruskan) for (const c of kad) if (!c.kunci && c.hari >= 0) cabut(st, c);
    // bersihkan kad berkunci yang bertembung sesama sendiri (biarkan)
    const U = new Set(kad.filter(c => c.hari < 0).map(c => c.id));
    const mustahil = new Set();
    for (const id of U) { const c = st.kad[id]; if (!semuaKedudukan(st, c).some(([d, s]) => strukturOK(st, c, d, s))) mustahil.add(id); }
    for (const id of mustahil) U.delete(id);

    const tabu = {}; let iter = 0, gegarAkhir = 0;
    const maks = opsyen.lelaran || P.tetapan.lelaran || 60000;
    let terbaik = { n: Infinity, pos: null };
    const simpanTerbaik = () => {
      if (U.size < terbaik.n) terbaik = { n: U.size, pos: kad.map(c => [c.hari, c.slot]), iter };
    };
    const rnd = Math.random;

    function domain(c) {
      let n = 0;
      for (let d = 0; d < st.D; d++) for (let s = 0; s + c.len <= st.S; s++) {
        const k = pertembungan(st, c, d, s); if (k && k.length === 0) n++;
      }
      return n;
    }

    function langkah() {
      if (!U.size) return false;
      // pilih kad paling sukar daripada sampel
      const arr = [...U]; let pilih = null, best = Infinity;
      const sampel = arr.length <= 10 ? arr : Array.from({ length: 10 }, () => arr[(rnd() * arr.length) | 0]);
      for (const id of sampel) {
        const c = st.kad[id];
        const dn = domain(c) - c.len * 0.01 + rnd() * 0.5;
        if (dn < best) { best = dn; pilih = c; }
      }
      const c = pilih;
      let calon = [], kosMin = Infinity;
      for (const [d, s] of semuaKedudukan(st, c)) {
        const k = pertembungan(st, c, d, s); if (!k) continue;
        if (k.some(id => st.kad[id].kunci)) continue;
        let kos = 0;
        for (const id of k) kos += 10 + (tabu[id] && tabu[id] > iter ? 50 : 0) + st.kad[id].len;
        kos += skorLembut(st, c, d, s) + rnd() * 3;
        if (kos < kosMin - 1e-9) { kosMin = kos; calon = [[d, s, k]]; }
        else if (Math.abs(kos - kosMin) < 1e-9) calon.push([d, s, k]);
      }
      if (!calon.length) { U.delete(c.id); mustahil.add(c.id); return true; }
      const [d, s, k] = calon[(rnd() * calon.length) | 0];
      for (const id of k) { const o = st.kad[id]; cabut(st, o); U.add(id); tabu[id] = iter + 8 + ((rnd() * 8) | 0); }
      pasang(st, c, d, s); U.delete(c.id); tabu[c.id] = iter + 4;
      iter++;
      simpanTerbaik();
      // tersekat lama: gegar (lepaskan sebahagian kad secara rawak)
      if (iter - (terbaik.iter || 0) > 3000 && iter - gegarAkhir > 3000) {
        gegarAkhir = iter;
        for (const o of kad) if (!o.kunci && o.hari >= 0 && rnd() < 0.06) { cabut(st, o); U.add(o.id); }
      }
      return true;
    }

    simpanTerbaik();
    return {
      st, U, mustahil,
      get iter() { return iter; },
      maks,
      jalan(n) { // jalankan n langkah; pulangkan true jika masih berjalan
        for (let i = 0; i < n; i++) { if (iter >= maks || !U.size) return false; if (!langkah()) return false; }
        return iter < maks && U.size > 0;
      },
      tamat() {
        if (terbaik.pos && terbaik.n < U.size) {
          // pulihkan keadaan terbaik
          for (const c of kad) if (c.hari >= 0) cabut(st, c);
          kad.forEach((c, i) => { const [d, s] = terbaik.pos[i]; if (d >= 0) pasang(st, c, d, s); });
          U.clear(); for (const c of kad) if (c.hari < 0 && !mustahil.has(c.id)) U.add(c.id);
        }
        return { diletak: kad.filter(c => c.hari >= 0).length, jumlah: kad.length, belum: U.size + mustahil.size, mustahil: [...mustahil], lelaran: iter };
      }
    };
  }

  /* Penambahbaikan kualiti: alih kad ke kedudukan bebas pertembungan yang skor lembutnya lebih baik */
  function kemaskan(st, n) {
    const kad = st.P.kad.filter(c => !c.kunci && c.hari >= 0);
    if (!kad.length) return 0;
    let baik = 0;
    for (let i = 0; i < n; i++) {
      const c = kad[(Math.random() * kad.length) | 0];
      const d0 = c.hari, s0 = c.slot;
      cabut(st, c);
      const asas = skorLembut(st, c, d0, s0);
      let best = null, bs = asas - 0.05;
      for (let d = 0; d < st.D; d++) for (let s = 0; s + c.len <= st.S; s++) {
        if (d === d0 && s === s0) continue;
        const k = pertembungan(st, c, d, s); if (!k || k.length) continue;
        const sc = skorLembut(st, c, d, s); if (sc < bs) { bs = sc; best = [d, s]; }
      }
      if (best) { pasang(st, c, best[0], best[1]); baik++; } else pasang(st, c, d0, s0);
    }
    return baik;
  }

  function jumlahSkor(st) {
    let t = 0;
    for (const c of st.P.kad) if (c.hari >= 0) { const d = c.hari, s = c.slot; cabut(st, c); t += skorLembut(st, c, d, s); pasang(st, c, d, s); }
    return t;
  }

  function janaSync(P, opsyen) {
    const g = Penjana(P, opsyen);
    while (g.jalan(500)) { /* teruskan */ }
    const r = g.tamat();
    r.kemas = kemaskan(g.st, (opsyen && opsyen.kemas) || 3000);
    return r;
  }

  /* ---------- semakan pertembungan keseluruhan ---------- */
  function semakSemua(P) {
    const t = P.tetapan, D = t.hari.length, S = bilSlot(t);
    const pel = Object.fromEntries(P.pelajaran.map(p => [p.id, p]));
    const isu = [], kelasM = {}, guruM = {}, bilikM = {};
    const tanda = (M, key, d, x, id, jenis) => {
      const k = key + "|" + d + "|" + x;
      if (M[k] && M[k] !== id) isu.push({ jenis, kad: [M[k], id], hari: d, slot: x, siapa: key }); else M[k] = id;
    };
    const avail = Object.fromEntries(P.kelas.map(k => [k.id, availKelas(t, k)]));
    for (const c of P.kad) {
      if (c.hari < 0) continue; const p = pel[c.pel]; if (!p) continue;
      for (let k = 0; k < c.len; k++) {
        const x = c.slot + k;
        if (x >= S || !avail[p.kelas] || !avail[p.kelas][c.hari][x]) isu.push({ jenis: "luar", kad: [c.id], hari: c.hari, slot: x, siapa: p.kelas });
        tanda(kelasM, p.kelas, c.hari, x, c.id, "kelas");
        for (const g of p.guru) tanda(guruM, g, c.hari, x, c.id, "guru");
        if (p.bilik) tanda(bilikM, p.bilik, c.hari, x, c.id, "bilik");
      }
    }
    return isu;
  }

  /* ---------- import daripada format jadual.html ---------- */
  function importJadualHtml(data, nama) {
    const P = projekKosong(nama || "Import Jadual");
    const t = P.tetapan, ms = t.minitSlot, g0 = toMin(t.mulaGrid);
    const acaraNama = new Set(t.acara.map(a => a.nama.toUpperCase()));
    const guruId = {}, subjekId = {};
    const warna = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#059669", "#b91c1c", "#7c3aed", "#0d9488", "#c2410c", "#4d7c0f", "#be185d"];
    const tambahGuru = (n) => {
      n = String(n || "").trim(); if (!n) return null;
      if (!guruId[n]) {
        const id = uid("g");
        const sing = n.split(/\s+bin\s+|\s+binti\s+|\s+/i)[0].slice(0, 10);
        P.guru.push({ id, nama: n, singkatan: sing, tiada: [] }); guruId[n] = id;
      }
      return guruId[n];
    };
    const tambahSubjek = (k) => {
      k = String(k || "").trim(); if (!subjekId[k]) { const id = uid("s"); P.subjek.push({ id, kod: k, nama: k, warna: warna[P.subjek.length % warna.length] }); subjekId[k] = id; }
      return subjekId[k];
    };
    for (const g of data.teachers || []) tambahGuru(g.name);
    const pelMap = {};
    for (const kl of data.classes || []) {
      const kid = uid("c");
      const tahun = Number(kl.level) || Number(String(kl.code).match(/\d/)?.[0]) || 1;
      P.kelas.push({ id: kid, kod: kl.code, nama: kl.name || "", tahun, guruKelas: kl.teacher || "" });
      for (const e of kl.entries || []) {
        if (acaraNama.has(String(e.subject).toUpperCase())) continue;
        const gs = String(e.teacher || "").split("/").map(s => s.trim()).filter(Boolean).map(tambahGuru).sort();
        const sid = tambahSubjek(e.subject);
        const key = kid + "|" + sid + "|" + gs.join(",");
        if (!pelMap[key]) { const p = { id: uid("p"), kelas: kid, subjek: sid, guru: gs, bilik: "", masa: 0, pecahan: [] }; pelMap[key] = p; P.pelajaran.push(p); }
        const p = pelMap[key];
        const len = Math.max(1, Math.round((toMin(e.end) - toMin(e.start)) / ms));
        p.masa += len; p.pecahan.push(len);
        const d = t.hari.indexOf(e.day), s = Math.round((toMin(e.start) - g0) / ms);
        P.kad.push({ id: uid("k"), pel: p.id, len, hari: d, slot: d >= 0 && s >= 0 ? s : -1, kunci: false });
        if (d < 0 || s < 0) { P.kad[P.kad.length - 1].hari = -1; }
      }
    }
    for (const p of P.pelajaran) {
      p.pecahan.sort((a, b) => b - a);
      // kekalkan amalan sekolah: jika subjek ini diajar >1 blok sehari, benarkan
      const per = {};
      for (const c of P.kad) if (c.pel === p.id && c.hari >= 0) per[c.hari] = (per[c.hari] || 0) + 1;
      const m = Math.max(0, ...Object.values(per));
      const asas = Math.max(t.maksBlokSehari || 1, Math.ceil(p.pecahan.length / t.hari.length));
      if (m > asas) p.maksSehari = m;
    }
    return P;
  }

  /* ---------- eksport ke format jadual.html (VERSION_DATA.data) ---------- */
  function eksportJadualHtml(P) {
    const t = P.tetapan;
    const pel = Object.fromEntries(P.pelajaran.map(p => [p.id, p]));
    const guru = Object.fromEntries(P.guru.map(g => [g.id, g]));
    const subj = Object.fromEntries(P.subjek.map(s => [s.id, s]));
    const kelasById = Object.fromEntries(P.kelas.map(k => [k.id, k]));
    const urut = (a, b) => t.hari.indexOf(a.day) - t.hari.indexOf(b.day) || toMin(a.start) - toMin(b.start);
    const teachers = P.guru.map(g => ({ name: g.nama, entries: [] }));
    const tIdx = Object.fromEntries(P.guru.map((g, i) => [g.id, i]));
    const classes = P.kelas.map(k => ({ code: k.kod, name: k.nama || "", level: String(k.tahun), teacher: k.guruKelas || "", entries: [] }));
    const cIdx = Object.fromEntries(P.kelas.map((k, i) => [k.id, i]));
    for (const k of P.kelas) {
      const th = tahapKelas(t, k);
      for (const a of t.acara || []) {
        if (a.tahap && a.tahap.length && th && !a.tahap.includes(th.id)) continue;
        for (const h of a.hari || []) classes[cIdx[k.id]].entries.push({ day: h, start: a.mula, end: a.tamat, subject: a.nama, teacher: a.guru || "" });
      }
    }
    for (const c of P.kad) {
      if (c.hari < 0) continue; const p = pel[c.pel]; if (!p) continue;
      const day = t.hari[c.hari], start = masaSlot(t, c.slot), end = masaSlot(t, c.slot + c.len);
      const sk = (subj[p.subjek] || {}).kod || "";
      const kl = kelasById[p.kelas];
      classes[cIdx[p.kelas]].entries.push({ day, start, end, subject: sk, teacher: p.guru.map(g => (guru[g] || {}).nama || "").join(" / ") });
      for (const g of p.guru) if (tIdx[g] !== undefined) teachers[tIdx[g]].entries.push({ day, start, end, subject: sk, class: kl ? kl.kod : "" });
    }
    teachers.forEach(x => x.entries.sort(urut)); classes.forEach(x => x.entries.sort(urut));
    return { teachers, classes };
  }

  /* ---------- import CSV agihan (Agihan Guru) ----------
     Lajur: Kelas, Subjek, Guru (pisah dengan "/"), Masa (bil. masa 30 minit seminggu), Pecahan (cth 2+2+1, pilihan), Bilik (pilihan)
  */
  function parseCSV(txt) {
    const rows = []; let row = [], cur = "", q = false;
    const sep = (txt.split("\n")[0].match(/\t/) ? "\t" : (txt.split("\n")[0].match(/;/) && !txt.split("\n")[0].match(/,/) ? ";" : ","));
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()));
  }

  function importAgihan(P, rows, ganti) {
    // rows: [{kelas, subjek, guru, masa, pecahan, bilik}]
    const cari = (arr, f, v) => arr.find(x => String(x[f]).trim().toUpperCase() === String(v).trim().toUpperCase());
    const laporan = { tambah: 0, kelasBaru: 0, guruBaru: 0, subjekBaru: 0, bilikBaru: 0, ralat: [] };
    if (ganti) { P.pelajaran = []; P.kad = []; }
    rows.forEach((r, i) => {
      if (!r.kelas || !r.subjek) { laporan.ralat.push("Baris " + (i + 2) + ": kelas/subjek kosong"); return; }
      let k = cari(P.kelas, "kod", r.kelas);
      if (!k) { k = { id: uid("c"), kod: String(r.kelas).trim(), nama: "", tahun: Number(String(r.kelas).match(/\d/)?.[0]) || 1, guruKelas: "" }; P.kelas.push(k); laporan.kelasBaru++; }
      let s = cari(P.subjek, "kod", r.subjek);
      if (!s) { s = { id: uid("s"), kod: String(r.subjek).trim(), nama: String(r.subjek).trim(), warna: "#64748b" }; P.subjek.push(s); laporan.subjekBaru++; }
      const gs = String(r.guru || "").split("/").map(x => x.trim()).filter(Boolean).map(n => {
        let g = cari(P.guru, "nama", n) || cari(P.guru, "singkatan", n);
        if (!g) { g = { id: uid("g"), nama: n, singkatan: n.split(/\s+/)[0].slice(0, 10), tiada: [] }; P.guru.push(g); laporan.guruBaru++; }
        return g.id;
      });
      let b = "";
      if (r.bilik) { let bl = cari(P.bilik, "nama", r.bilik); if (!bl) { bl = { id: uid("b"), nama: String(r.bilik).trim() }; P.bilik.push(bl); laporan.bilikBaru++; } b = bl.id; }
      const masa = Math.round(Number(r.masa) || 0);
      if (!masa) { laporan.ralat.push("Baris " + (i + 2) + ": bilangan masa tidak sah"); return; }
      const pec = String(r.pecahan || "").split(/[+,\s]+/).map(Number).filter(n => n > 0);
      P.pelajaran.push({ id: uid("p"), kelas: k.id, subjek: s.id, guru: gs, bilik: b, masa, pecahan: pec.reduce((a, c) => a + c, 0) === masa ? pec : pecahanLalai(masa) });
      laporan.tambah++;
    });
    selaraskanKad(P);
    return laporan;
  }

  function barisDariCSV(txt) {
    const rows = parseCSV(txt); if (!rows.length) return [];
    const h = rows[0].map(x => String(x).trim().toLowerCase());
    const idx = (...n) => h.findIndex(x => n.some(k => x.includes(k)));
    const ik = idx("kelas"), is = idx("subjek", "mata pelajaran", "mp"), ig = idx("guru"), im = idx("masa", "waktu", "jam"), ip = idx("pecahan", "blok"), ib = idx("bilik");
    return rows.slice(1).map(r => ({ kelas: r[ik], subjek: r[is], guru: ig >= 0 ? r[ig] : "", masa: im >= 0 ? r[im] : 0, pecahan: ip >= 0 ? r[ip] : "", bilik: ib >= 0 ? r[ib] : "" }));
  }

  const API = {
    HARI_LALAI, toMin, toHHMM, uid, tetapanLalai, projekKosong, bilSlot, masaSlot, tahapKelas, availKelas,
    pecahanLalai, pecahanSah, selaraskanKad, binaKeadaan, pasang, cabut, strukturOK, pertembungan,
    Penjana, janaSync, kemaskan, jumlahSkor, skorLembut, semakSemua, importJadualHtml, eksportJadualHtml, parseCSV, barisDariCSV, importAgihan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.TTEngine = API;
})(typeof window !== "undefined" ? window : globalThis);
