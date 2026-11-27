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

  /* ---------- grid & waktu loceng ----------
     Lalai: grid seragam (mulaGrid + minitSlot). Pilihan: t.slotMasa = [{mula, tamat}] (waktu loceng sendiri,
     panjang boleh berbeza, cth 40/45 minit) dan th.slotMasa bagi tahap yang mempunyai loceng berbeza
     (bilangan slot mesti sama — slot ke-i semua tahap dianggap serentak untuk semakan guru). */
  function slotSeragam(t) {
    const g0 = toMin(t.mulaGrid), ms = Number(t.minitSlot) || 30;
    const n = Math.max(0, Math.round((toMin(t.tamatGrid) - g0) / ms));
    return Array.from({ length: n }, (_, i) => ({ mula: toHHMM(g0 + i * ms), tamat: toHHMM(g0 + (i + 1) * ms) }));
  }
  function bilSlot(t) { return t.slotMasa && t.slotMasa.length ? t.slotMasa.length : slotSeragam(t).length; }
  function locengTahap(t, th) {
    const S = bilSlot(t);
    if (th && th.slotMasa && th.slotMasa.length === S) return th.slotMasa;
    return t.slotMasa && t.slotMasa.length ? t.slotMasa : slotSeragam(t);
  }
  // masa mula slot i (i === S -> masa tamat slot terakhir); th pilihan = ikut loceng tahap
  function masaSlot(t, i, th) {
    const L = locengTahap(t, th);
    if (i < L.length) return L[i].mula;
    if (!L.length) return t.mulaGrid;
    const akhir = L[L.length - 1], len = toMin(akhir.tamat) - toMin(akhir.mula);
    return toHHMM(toMin(akhir.tamat) + (i - L.length) * len);
  }
  function masaTamat(t, i, th) { const L = locengTahap(t, th); return i < L.length ? L[i].tamat : masaSlot(t, i + 1, th); }
  function tahapKelas(t, k) {
    const y = Number(k.tahun);
    return t.tahap.find(x => (x.tahun || []).map(Number).includes(y)) || t.tahap[0];
  }
  const tiadaSet = (t, keys) => { const D = t.hari.length, S = bilSlot(t), g = Array.from({ length: D }, () => new Array(S).fill(false)); for (const key of keys || []) { const [h, x] = String(key).split("|"); const d = t.hari.indexOf(h); if (d >= 0 && +x < S) g[d][+x] = true; } return g; };

  /* Matriks kebolehsediaan kelas: avail[hari][slot] = true jika boleh diisi pelajaran
     (dalam waktu tahap, bukan rehat/acara, bukan masa tidak tersedia kelas) */
  function availKelas(t, k) {
    const th = tahapKelas(t, k), L = locengTahap(t, th);
    const off = k && k.tiada && k.tiada.length ? tiadaSet(t, k.tiada) : null;
    return t.hari.map((h, d) => {
      const row = [];
      const end = toMin((th && th.tamat && th.tamat[h]) || t.tamatGrid);
      for (let s = 0; s < L.length; s++) {
        const a = toMin(L[s].mula), b = toMin(L[s].tamat);
        let ok = b <= end && !(off && off[d][s]);
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

  /* ---------- pelajaran: kelas gabungan, kumpulan, bilik ---------- */
  // semua kelas yang terlibat (kelas utama + kelas gabungan / joint classes)
  function kelasPel(p) { return p ? (p.kelasTambah && p.kelasTambah.length ? [p.kelas, ...p.kelasTambah.filter(k => k && k !== p.kelas)] : [p.kelas]) : []; }
  // kumpulan (division): "" = seluruh kelas; nama sama tidak boleh serentak, nama berbeza boleh serentak
  function kumpPel(p) { return (p && String(p.kumpulan || "").trim().toUpperCase()) || "*"; }
  function bilikCalon(p) { return p && p.bilik ? [p.bilik] : (p && p.bilikPilihan ? p.bilikPilihan.filter(Boolean) : []); }

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

  /* ---------- tugas acara ikut guru waktu sebelum (cth Pembentukan Karakter) ----------
     acara.guruDari = indeks slot sumber (cth waktu 8:30-9:00). Guru yang mengajar kelas pada slot itu
     menjadi guru acara pada hari tersebut. acara.unikHari: guru berbeza setiap hari bagi kelas sama (wajib);
     acara.unikKelas: elakkan guru sama menjadi guru acara bagi kelas lain dalam minggu itu (lembut).
     Guru acara juga tidak boleh mengajar kelas lain pada slot yang bertindih dengan masa acara. */
  function tugasAcara(P) {
    const t = P.tetapan, out = [];
    (t.acara || []).forEach((a, ai) => {
      if (a.guruDari === undefined || a.guruDari === null || a.guruDari === "" || +a.guruDari < 0) return;
      const kelas = [], ts = new Set();
      for (const k of P.kelas) {
        const th = tahapKelas(t, k);
        if (a.tahap && a.tahap.length && !(th && a.tahap.includes(th.id))) continue;
        kelas.push(k.id);
        locengTahap(t, th).forEach((x, i) => { if (toMin(x.mula) < toMin(a.tamat) && toMin(x.tamat) > toMin(a.mula)) ts.add(i); });
      }
      const hari = new Set((a.hari || []).map(h => t.hari.indexOf(h)).filter(d => d >= 0));
      if (kelas.length && hari.size) out.push({ ai, nama: a.nama, rs: +a.guruDari, kelas: new Set(kelas), hari, ts: [...ts], unikHari: a.unikHari !== false, unikKelas: a.unikKelas !== false });
    });
    return out;
  }
  // guru bagi slot sumber tugas pada (kelas, hari)
  function guruTugas(st, T, kl, d) {
    const m = st.kelasKump[kl] && st.kelasKump[kl][d][T.rs]; if (!m) return [];
    const g = new Set(); for (const id of Object.values(m)) { const c = st.kad[id], p = c && st.pel[c.pel]; if (p) p.guru.forEach(x => g.add(x)); }
    return [...g];
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
      avail: {}, kelasOcc: {}, kelasKump: {}, guruOcc: {}, bilikOcc: {}, tiada: {}, tiadaSub: {}, tiadaBilik: {},
      harian: {}, kadPel: {}, kadKelas: {}, had: {}, hub: {}, tugas: tugasAcara(P)
    };
    const subj = Object.fromEntries((P.subjek || []).map(x => [x.id, x]));
    for (const c of P.kad) (st.kadPel[c.pel] = st.kadPel[c.pel] || []).push(c);
    for (const p of P.pelajaran) {
      const sm = subj[p.subjek] && Number(subj[p.subjek].maksSehari);
      st.had[p.id] = Number(p.maksSehari) > 0 ? Number(p.maksSehari) : sm > 0 ? sm : Math.max(t.maksBlokSehari || 1, Math.ceil((st.kadPel[p.id] || []).length / D));
      for (const k of kelasPel(p)) for (const c of st.kadPel[p.id] || []) (st.kadKelas[k] = st.kadKelas[k] || []).push(c);
    }
    for (const k of P.kelas) {
      st.avail[k.id] = availKelas(t, k); st.kelasOcc[k.id] = grid();
      st.kelasKump[k.id] = Array.from({ length: D }, () => Array.from({ length: S }, () => ({})));
    }
    for (const g of P.guru) { st.guruOcc[g.id] = grid(); st.tiada[g.id] = tiadaSet(t, g.tiada); }
    for (const x of P.subjek || []) if (x.tiada && x.tiada.length) st.tiadaSub[x.id] = tiadaSet(t, x.tiada);
    for (const b of P.bilik) { st.bilikOcc[b.id] = grid(); if (b.tiada && b.tiada.length) st.tiadaBilik[b.id] = tiadaSet(t, b.tiada); }
    // hubungan: subjek yang tidak boleh berada pada hari yang sama bagi kelas yang sama
    for (const h of t.hubungan || []) {
      if (h.jenis !== "bukanHariSama") continue;
      const ids = (h.subjek || []).filter(Boolean);
      for (const a of ids) for (const b of ids) if (a !== b) (st.hub[a] = st.hub[a] || new Set()).add(b);
    }
    for (const c of P.kad) if (c.hari >= 0) pasang(st, c, c.hari, c.slot, true);
    return st;
  }

  function harianKey(c, d) { return c.pel + "|" + d; }

  /* Pilih bilik bagi kad di (d,s): bilik bebas jika ada; jika tidak, bilik dengan pertembungan paling sedikit.
     Pulangkan { r, konflik: [] } atau null jika tiada bilik calon yang tersedia (masa tidak tersedia bilik). */
  function pilihBilik(st, c, d, s, utama) {
    const p = st.pel[c.pel], calon = bilikCalon(p);
    if (!calon.length) return { r: "", konflik: [] };
    let best = null;
    const urut = utama && calon.includes(utama) ? [utama, ...calon.filter(x => x !== utama)] : calon;
    for (const r of urut) {
      const occ = st.bilikOcc[r]; if (!occ) continue;
      const off = st.tiadaBilik[r]; let ok = true; const set = new Set();
      for (let k = 0; k < c.len; k++) { const x = s + k; if (x >= st.S || (off && off[d][x])) { ok = false; break; } const o = occ[d][x]; if (o && o !== c.id) set.add(o); }
      if (!ok) continue;
      if (!set.size) return { r, konflik: [] };
      if (!best || set.size < best.konflik.length) best = { r, konflik: [...set] };
    }
    return best;
  }

  function pasang(st, c, d, s, paksa) {
    const p = st.pel[c.pel]; if (!p) return;
    c.hari = d; c.slot = s;
    const kp = kumpPel(p);
    const calon = bilikCalon(p);
    if (calon.length) {
      if (!(paksa && calon.includes(c.bilik))) { const pb = pilihBilik(st, c, d, s, c.bilik); c.bilik = pb ? pb.r : calon[0]; }
    } else if (c.bilik) delete c.bilik;
    for (let k = 0; k < c.len; k++) {
      const x = s + k; if (x >= st.S) continue;
      for (const kl of kelasPel(p)) if (st.kelasKump[kl]) {
        st.kelasKump[kl][d][x][kp] = c.id;
        if (!st.kelasOcc[kl][d][x]) st.kelasOcc[kl][d][x] = c.id;
      }
      for (const g of p.guru) if (st.guruOcc[g]) st.guruOcc[g][d][x] = c.id;
      if (c.bilik && st.bilikOcc[c.bilik]) st.bilikOcc[c.bilik][d][x] = c.id;
    }
    const hk = harianKey(c, d); st.harian[hk] = (st.harian[hk] || 0) + 1;
  }

  function cabut(st, c) {
    if (c.hari < 0) return;
    const p = st.pel[c.pel], d = c.hari, s = c.slot;
    if (p) {
      const kp = kumpPel(p);
      for (let k = 0; k < c.len; k++) {
        const x = s + k; if (x >= st.S) continue;
        const lepas = (g) => { if (g && g[d][x] === c.id) g[d][x] = null; };
        for (const kl of kelasPel(p)) if (st.kelasKump[kl]) {
          const m = st.kelasKump[kl][d][x];
          if (m[kp] === c.id) delete m[kp];
          if (st.kelasOcc[kl][d][x] === c.id) { const v = Object.values(m); st.kelasOcc[kl][d][x] = v.length ? v[0] : null; }
        }
        for (const g of p.guru) lepas(st.guruOcc[g]);
        if (c.bilik) lepas(st.bilikOcc[c.bilik]);
      }
    }
    const hk = harianKey(c, d); st.harian[hk] = Math.max(0, (st.harian[hk] || 1) - 1);
    c.hari = -1; c.slot = -1;
  }

  function hadSehari(st, p) { return st.had[p.id] || 1; }

  /* Struktur: adakah blok boleh berada di (d,s) jika semua kad lain diabaikan? */
  function strukturOK(st, c, d, s) {
    const p = st.pel[c.pel]; if (!p) return false;
    const kls = kelasPel(p);
    const offS = st.tiadaSub[p.subjek];
    for (let k = 0; k < c.len; k++) {
      const x = s + k;
      if (x >= st.S) return false;
      for (const kl of kls) { const av = st.avail[kl]; if (!av || !av[d][x]) return false; }
      for (const g of p.guru) if (st.tiada[g] && st.tiada[g][d][x]) return false;
      if (offS && offS[d][x]) return false;
    }
    if (bilikCalon(p).length && !pilihBilik(st, c, d, s)) return false;
    return true;
  }

  /* Senarai kad yang bertembung jika c diletak di (d,s). null = mustahil secara struktur. */
  function pertembungan(st, c, d, s) {
    if (!strukturOK(st, c, d, s)) return null;
    const p = st.pel[c.pel], set = new Set(), kp = kumpPel(p), kls = kelasPel(p);
    for (let k = 0; k < c.len; k++) {
      const x = s + k;
      for (const kl of kls) {
        const m = st.kelasKump[kl] && st.kelasKump[kl][d][x]; if (!m) continue;
        if (kp === "*") { for (const id of Object.values(m)) if (id !== c.id) set.add(id); }
        else { if (m["*"] && m["*"] !== c.id) set.add(m["*"]); if (m[kp] && m[kp] !== c.id) set.add(m[kp]); }
      }
      for (const g of p.guru) { const b = st.guruOcc[g] && st.guruOcc[g][d][x]; if (b && b !== c.id) set.add(b); }
    }
    // bilik: bilik tetap atau salah satu bilik pilihan
    const pb = pilihBilik(st, c, d, s, c.bilik);
    if (pb) for (const id of pb.konflik) set.add(id);
    // had blok sehari bagi pelajaran sama
    const lim = hadSehari(st, p);
    const sama = (st.kadPel[c.pel] || []).filter(o => o.pel === c.pel && o.id !== c.id && o.hari === d && !set.has(o.id));
    if (sama.length >= lim) {
      // perlu keluarkan satu (yang tidak berkunci jika boleh)
      const buang = sama.find(o => !o.kunci) || sama[0];
      set.add(buang.id);
    }
    // hubungan: subjek berkaitan tidak boleh pada hari yang sama (kelas sama)
    const hub = st.hub[p.subjek];
    if (hub) for (const kl of kls) for (const o of st.kadKelas[kl] || []) {
      if (o.id === c.id || o.hari !== d || set.has(o.id)) continue;
      const po = st.pel[o.pel]; if (po && hub.has(po.subjek)) set.add(o.id);
    }
    // tugas acara (cth Pembentukan Karakter)
    for (const T of st.tugas) {
      if (!T.hari.has(d)) continue;
      const sumber = s <= T.rs && T.rs < s + c.len && kls.some(kl => T.kelas.has(kl));
      if (sumber) {
        // (a) guru acara tidak boleh mengajar slot yang bertindih dengan masa acara
        for (const g of p.guru) for (const x of T.ts) { const o = st.guruOcc[g] && st.guruOcc[g][d][x]; if (o && o !== c.id) set.add(o); }
        // (b) guru berbeza setiap hari bagi kelas yang sama
        if (T.unikHari) for (const kl of kls) if (T.kelas.has(kl)) for (const d2 of T.hari) {
          if (d2 === d) continue;
          const m = st.kelasKump[kl] && st.kelasKump[kl][d2][T.rs]; if (!m) continue;
          for (const id of Object.values(m)) { if (id === c.id || set.has(id)) continue; const po = st.pel[st.kad[id].pel]; if (po && po.guru.some(g => p.guru.includes(g))) set.add(id); }
        }
      }
      // (c) kad yang bertindih dengan masa acara: guru itu tidak boleh menjadi guru acara hari itu
      if (T.ts.some(x => s <= x && x < s + c.len)) for (const kl of T.kelas) {
        const m = st.kelasKump[kl] && st.kelasKump[kl][d][T.rs]; if (!m) continue;
        for (const id of Object.values(m)) { if (id === c.id || set.has(id)) continue; const po = st.pel[st.kad[id].pel]; if (po && po.guru.some(g => p.guru.includes(g))) set.add(id); }
      }
    }
    // had masa sehari guru (keras)
    for (const g of p.guru) {
      const gr = st.guru[g], mx = gr && Number(gr.maksSehari); if (!(mx > 0)) continue;
      const occ = st.guruOcc[g]; if (!occ) continue;
      const lain = {}; let n = 0;
      for (const id of occ[d]) if (id && id !== c.id && !set.has(id)) { n++; lain[id] = (lain[id] || 0) + 1; }
      if (n + c.len <= mx) continue;
      const calon = Object.keys(lain).map(id => st.kad[id]).sort((a, b) => (a.kunci - b.kunci) || (b.len - a.len));
      for (const o of calon) { if (n + c.len <= mx) break; set.add(o.id); n -= lain[o.id]; }
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
      const gr = st.guru[g] || {}, maksRun = Number(gr.maksBerturut) || t.maksBerturutGuru || 99;
      // masa berturut-turut
      let run = c.len, x = s - 1; while (x >= 0 && occ[d][x]) { run++; x--; }
      x = s + c.len; while (x < st.S && occ[d][x]) { run++; x++; }
      if (run > maksRun) sc += 6 * (run - maksRun);
      // waktu kosong (gap) guru dalam sehari
      if (gr.maksGap !== undefined && gr.maksGap !== "" && Number(gr.maksGap) >= 0) {
        let a = -1, b = -1, isi = 0;
        for (let y = 0; y < st.S; y++) { const on = occ[d][y] || (y >= s && y < s + c.len); if (on) { if (a < 0) a = y; b = y; isi++; } }
        const gap = a < 0 ? 0 : (b - a + 1) - isi;
        if (gap > Number(gr.maksGap)) sc += 3 * (gap - Number(gr.maksGap));
      }
    }
    // tugas acara: elakkan guru sama menjadi guru acara bagi kelas lain dalam minggu itu
    for (const T of st.tugas) {
      if (!T.unikKelas || !T.hari.has(d) || !(s <= T.rs && T.rs < s + c.len)) continue;
      const kls = kelasPel(p); if (!kls.some(kl => T.kelas.has(kl))) continue;
      for (const kl2 of T.kelas) for (const d2 of T.hari) {
        if (kls.includes(kl2)) continue;
        if (guruTugas(st, T, kl2, d2).some(g => p.guru.includes(g))) sc += 12;
      }
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

  /* ---------- semakan pertembungan keseluruhan ----------
     jenis: kelas | guru | bilik | luar (luar waktu / rehat / masa tidak tersedia) | hadGuru | hubungan */
  function semakSemua(P) {
    const t = P.tetapan, D = t.hari.length, S = bilSlot(t);
    const pel = Object.fromEntries(P.pelajaran.map(p => [p.id, p]));
    const isu = [], guruM = {}, bilikM = {}, kelasM = {};
    const tanda = (M, key, d, x, id, jenis) => {
      const k = key + "|" + d + "|" + x;
      if (M[k] && M[k] !== id) isu.push({ jenis, kad: [M[k], id], hari: d, slot: x, siapa: key }); else M[k] = id;
    };
    const avail = Object.fromEntries(P.kelas.map(k => [k.id, availKelas(t, k)]));
    const tiadaG = Object.fromEntries(P.guru.map(g => [g.id, tiadaSet(t, g.tiada)]));
    const tiadaS = Object.fromEntries((P.subjek || []).filter(x => x.tiada && x.tiada.length).map(x => [x.id, tiadaSet(t, x.tiada)]));
    const bil = Object.fromEntries(P.bilik.map(b => [b.id, b]));
    const tiadaB = Object.fromEntries(P.bilik.filter(b => b.tiada && b.tiada.length).map(b => [b.id, tiadaSet(t, b.tiada)]));
    const sehari = {};
    for (const c of P.kad) {
      if (c.hari < 0) continue; const p = pel[c.pel]; if (!p) continue;
      const kp = kumpPel(p), br = p.bilik || c.bilik || "";
      for (let k = 0; k < c.len; k++) {
        const x = c.slot + k;
        let luar = x >= S || (tiadaS[p.subjek] && tiadaS[p.subjek][c.hari][x]) || p.guru.some(g => tiadaG[g] && tiadaG[g][c.hari][x]) || (br && tiadaB[br] && tiadaB[br][c.hari][x]);
        for (const kl of kelasPel(p)) {
          if (!avail[kl] || !avail[kl][c.hari][x]) luar = true;
          const m = (kelasM[kl + "|" + c.hari + "|" + x] = kelasM[kl + "|" + c.hari + "|" + x] || {});
          const lawan = kp === "*" ? Object.values(m) : [m["*"], m[kp]].filter(Boolean);
          for (const o of lawan) if (o !== c.id) isu.push({ jenis: "kelas", kad: [o, c.id], hari: c.hari, slot: x, siapa: kl });
          if (!lawan.length) m[kp] = c.id;
        }
        if (luar) isu.push({ jenis: "luar", kad: [c.id], hari: c.hari, slot: x, siapa: p.kelas });
        for (const g of p.guru) { tanda(guruM, g, c.hari, x, c.id, "guru"); const kk = g + "|" + c.hari; sehari[kk] = (sehari[kk] || 0) + 1; }
        if (br) tanda(bilikM, br, c.hari, x, c.id, "bilik");
      }
    }
    for (const g of P.guru) {
      const mx = Number(g.maksSehari); if (!(mx > 0)) continue;
      for (let d = 0; d < D; d++) if ((sehari[g.id + "|" + d] || 0) > mx) {
        const kad = P.kad.filter(c => c.hari === d && pel[c.pel] && pel[c.pel].guru.includes(g.id)).map(c => c.id);
        isu.push({ jenis: "hadGuru", kad, hari: d, slot: -1, siapa: g.id });
      }
    }
    for (const h of t.hubungan || []) {
      if (h.jenis !== "bukanHariSama") continue;
      const set = new Set(h.subjek || []), per = {};
      for (const c of P.kad) { if (c.hari < 0) continue; const p = pel[c.pel]; if (!p || !set.has(p.subjek)) continue;
        for (const kl of kelasPel(p)) { const key = kl + "|" + c.hari; (per[key] = per[key] || []).push(c); } }
      for (const [key, arr] of Object.entries(per)) if (new Set(arr.map(c => pel[c.pel].subjek)).size > 1) isu.push({ jenis: "hubungan", kad: arr.map(c => c.id), hari: +key.split("|")[1], slot: -1, siapa: key.split("|")[0] });
    }
    void bil;
    const tg = tugasAcara(P);
    if (tg.length) {
      const st = binaKeadaan(P);
      for (const T of tg) {
        const kira = {};
        for (const kl of T.kelas) {
          const perHari = {};
          for (const d of T.hari) {
            const g = guruTugas(st, T, kl, d), kad = Object.values(st.kelasKump[kl][d][T.rs] || {});
            if (!g.length) { isu.push({ jenis: "tugasKosong", kad: [], hari: d, slot: T.rs, siapa: kl, acara: T.nama }); continue; }
            for (const x of g) {
              (perHari[x] = perHari[x] || []).push(d); (kira[x] = kira[x] || []).push(kl + "|" + d);
              for (const tx of T.ts) { const o = st.guruOcc[x] && st.guruOcc[x][d][tx]; if (o && !kad.includes(o)) isu.push({ jenis: "tugasGuru", kad: [o, ...kad], hari: d, slot: tx, siapa: x, acara: T.nama }); }
            }
          }
          if (T.unikHari) for (const [g, hs] of Object.entries(perHari)) if (hs.length > 1) isu.push({ jenis: "tugasHari", kad: [], hari: hs[1], slot: -1, siapa: g, kelas: kl, acara: T.nama });
        }
        if (T.unikKelas) for (const [g, arr] of Object.entries(kira)) { const k = new Set(arr.map(x => x.split("|")[0])); if (k.size > 1) isu.push({ jenis: "tugasKelas", kad: [], hari: -1, slot: -1, siapa: g, acara: T.nama, n: k.size }); }
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
    const tugasE = [];
    for (const k of P.kelas) {
      const th = tahapKelas(t, k);
      for (const a of t.acara || []) {
        if (a.tahap && a.tahap.length && th && !a.tahap.includes(th.id)) continue;
        for (const h of a.hari || []) {
          if (a.guruDari !== undefined && a.guruDari !== "" && +a.guruDari >= 0) { tugasE.push({ a, k, h }); continue; }
          classes[cIdx[k.id]].entries.push({ day: h, start: a.mula, end: a.tamat, subject: a.nama, teacher: a.guru || "" });
        }
      }
    }
    const bilikN = Object.fromEntries(P.bilik.map(b => [b.id, b.nama]));
    if (tugasE.length) {
      const st = binaKeadaan(P);
      for (const { a, k, h } of tugasE) {
        const d = t.hari.indexOf(h); if (d < 0) continue;
        const gs = guruTugas(st, { rs: +a.guruDari }, k.id, d);
        classes[cIdx[k.id]].entries.push({ day: h, start: a.mula, end: a.tamat, subject: a.nama, teacher: gs.map(g => (guru[g] || {}).nama || "").join(" / ") });
        for (const g of gs) if (tIdx[g] !== undefined) teachers[tIdx[g]].entries.push({ day: h, start: a.mula, end: a.tamat, subject: a.nama, class: k.kod });
      }
    }
    for (const c of P.kad) {
      if (c.hari < 0) continue; const p = pel[c.pel]; if (!p) continue;
      const day = t.hari[c.hari];
      const sk = (subj[p.subjek] || {}).kod || "";
      const kls = kelasPel(p).map(id => kelasById[id]).filter(Boolean);
      const room = bilikN[p.bilik || c.bilik] || "";
      const kod = kls.map(k => k.kod).join("/") + (p.kumpulan ? " (" + p.kumpulan + ")" : "");
      for (const kl of kls) {
        const th = tahapKelas(t, kl);
        const e = { day, start: masaSlot(t, c.slot, th), end: masaTamat(t, c.slot + c.len - 1, th), subject: sk, teacher: p.guru.map(g => (guru[g] || {}).nama || "").join(" / ") };
        if (room) e.room = room; if (p.kumpulan) e.group = p.kumpulan;
        classes[cIdx[kl.id]].entries.push(e);
      }
      const th0 = kls[0] ? tahapKelas(t, kls[0]) : null;
      for (const g of p.guru) if (tIdx[g] !== undefined) {
        const e = { day, start: masaSlot(t, c.slot, th0), end: masaTamat(t, c.slot + c.len - 1, th0), subject: sk, class: kod };
        if (room) e.room = room;
        teachers[tIdx[g]].entries.push(e);
      }
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

  /* ---------- import daripada Agihan Guru (agihan.html / Supabase v_agihan) ----------
     agihan: [{kelas:"1 AMANAH", tahun, subjek_kod, slot, guru, waktu}]
     Pulangkan baris {kelas, subjek, guru, masa, pecahan, bilik} untuk importAgihan(),
     mengikut amalan jadual sekolah:
       PSM -> MZK;  PJPK -> PJ + PK (1/3);
       PI (+PIQK, TSK) -> PI-Q (guru PI + guru kolaborasi), TAS (guru PI + guru kolaborasi),
                          baki -> PI-U + PI-J (1).
     P (pilihan): projek semasa — pecahan sedia ada dikekalkan jika jumlahnya sama. */
  function kodKelasAgihan(nama) {
    const m = String(nama || "").trim().match(/^(\d)\s*([A-Za-z])/);
    return m ? m[1] + m[2].toUpperCase() : String(nama || "").trim();
  }
  // Kod lama/baharu Agihan Guru -> kod jadual. Kod lain dipadankan terus (cth. BM, PI-U, PI-J, PK, AM).
  const ALIAS_AGIHAN = { PSM: "MZK", PIQK: "PI-Q", TSK: "TAS", TMK: "TAS", PJPK: "PJ", PI: "PI-J" };
  function barisDariAgihanGuru(agihan, P) {
    const ikutKelas = {};
    for (const a of agihan || []) {
      const k = kodKelasAgihan(a.kelas);
      const kod = ALIAS_AGIHAN[a.subjek_kod] || a.subjek_kod;
      const s = (ikutKelas[k] ||= {});
      const o = (s[kod] ||= { guru: [], waktu: 0, slot: 0 });
      o.waktu += Number(a.waktu) || 0; o.slot++;
      if (a.guru && !o.guru.includes(a.guru)) o.guru.push(a.guru);
    }
    const pecLama = {};
    if (P) {
      const sk = Object.fromEntries((P.subjek || []).map(s => [s.id, String(s.kod).toUpperCase()]));
      const kk = Object.fromEntries((P.kelas || []).map(k => [k.id, String(k.kod).toUpperCase()]));
      for (const p of P.pelajaran || []) if (p.pecahan && p.pecahan.length) pecLama[kk[p.kelas] + "|" + sk[p.subjek]] = p.pecahan;
    }
    const out = [];
    const uniq = arr => arr.filter((g, i, x) => g && x.indexOf(g) === i);
    const tambah = (kelas, subjek, guru, masa) => {
      masa = Math.round(masa);
      if (!(masa > 0)) return;
      const lama = pecLama[kelas.toUpperCase() + "|" + subjek.toUpperCase()];
      const pec = lama && lama.reduce((x, y) => x + y, 0) === masa ? lama.join("+") : "";
      out.push({ kelas, subjek, guru: uniq(guru).join(" / "), masa, pecahan: pec, bilik: "" });
    };
    for (const k of Object.keys(ikutKelas).sort()) {
      const S = ikutKelas[k];
      // Struktur LAMA (sheet asal): PI-J/PI = 8 waktu termasuk PI-U, PI-J, PI-Q & TAS; guru PI turut mengajar PI-Q & TAS.
      const piLama = S["PI-J"] && S["PI-J"].waktu >= 4 && !S["PI-U"];
      // PJ lama = PJ + PK (tiada PK berasingan)
      const pjLama = S.PJ && !S.PK && S.PJ.waktu >= 3;
      for (const [kod, o] of Object.entries(S)) {
        if (piLama && (kod === "PI-Q" || kod === "TAS")) continue;
        if (pjLama && kod === "PJ") {
          const pk = Math.round(o.waktu / 3);
          tambah(k, "PJ", o.guru, o.waktu - pk); tambah(k, "PK", o.guru, pk);
        } else if (piLama && kod === "PI-J") {
          const gPI = o.guru[0];
          const q = S["PI-Q"], t = S.TAS;
          const piq = q ? q.waktu : 0, tas = t ? t.waktu : 0;
          if (q) tambah(k, "PI-Q", [...q.guru, gPI], piq);
          if (t) tambah(k, "TAS", [...t.guru, gPI], tas);
          const baki = o.waktu - piq - tas;
          const j = baki >= 2 ? 1 : 0;
          tambah(k, "PI-U", o.guru, baki - j); tambah(k, "PI-J", o.guru, j);
        } else {
          tambah(k, kod, o.guru, o.waktu);   // struktur baharu: satu-satu (guru kolaborasi digabung dengan "/")
        }
      }
    }
    return out;
  }

  const API = {
    kodKelasAgihan, barisDariAgihanGuru,
    HARI_LALAI, toMin, toHHMM, uid, tetapanLalai, projekKosong, bilSlot, masaSlot, masaTamat, slotSeragam, locengTahap, tahapKelas, availKelas,
    kelasPel, kumpPel, bilikCalon, pilihBilik, tiadaSet, tugasAcara, guruTugas,
    pecahanLalai, pecahanSah, selaraskanKad, binaKeadaan, pasang, cabut, strukturOK, pertembungan,
    Penjana, janaSync, kemaskan, jumlahSkor, skorLembut, semakSemua, importJadualHtml, eksportJadualHtml, parseCSV, barisDariCSV, importAgihan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.TTEngine = API;
})(typeof window !== "undefined" ? window : globalThis);
