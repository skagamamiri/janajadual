# Jana Jadual — SK Agama (MIS) Miri

Penjana jadual waktu automatik (gaya aSc Timetables) untuk ICT HUB.
HTML + JavaScript, simpanan Supabase. UI dalam Bahasa Melayu.

## Fail

| Fail | Fungsi |
|---|---|
| `index.html` | Aplikasi: Tetapan, Guru, Kelas, Subjek & Bilik, Agihan, Jana, Jadual (editor), Cetak & Terbit |
| `jana-jadual-engine.js` | Enjin: model data, kekangan, penjana automatik, import/eksport format `jadual.html` |
| `supabase/skema.sql` | Jadual `tt_projek`, `tt_terbit`, `tt_kunci` + fungsi RPC berkata laluan |
| `agihan.html` | **Agihan Guru Mata Pelajaran** — sistem agihan guru (lihat bahagian di bawah) |
| `supabase/agihan-skema.sql` | Skema Supabase untuk Agihan Guru (rujukan) |

## Pemasangan

1. Supabase Dashboard → SQL Editor → jalankan `supabase/skema.sql`
   (tukar `TukarSaya123` kepada kata laluan admin sendiri dahulu).
2. Settings → Pages → Deploy from branch `main` / root.
   Alamat: `https://skagamamiri.github.io/janajadual/`
3. Dalam aplikasi: **Projek → Sambungan** → tampal anon/publishable key
   (atau isi `SUPABASE_KEY_LALAI` dalam `index.html`).
4. Tambah ke Panel Pentadbir ICT HUB sebagai tool jenis URL (halaman ini tiada header sendiri; ICT HUB menyediakan bingkai/header).

Tanpa Supabase aplikasi tetap berfungsi (simpanan pelayar + muat turun fail projek).

## Integrasi

- **Import** jadual semasa dari `https://skagamamiri.github.io/tools/jadual.html` (`JADUAL_HTML_URL`).
- **Import agihan → Terus dari sistem Agihan Guru**: butang *Ambil* memanggil `agihan_untuk_jana()` (Supabase *agihan-guru*)
  dan menggantikan agihan projek. Pemetaan ikut amalan jadual sekolah: `1 AMANAH`→`1A`, `PSM`→`MZK`,
  `PJPK`→`PJ`+`PK`, `PI`→`PI-U`+`PI-J`+`PI-Q`+`TAS` (PI-Q/TAS = guru PI + guru kolaborasi). Pecahan blok sedia ada dikekalkan,
  guru kelas turut dikemas kini. Fungsi enjin: `barisDariAgihanGuru()`.
- **Import agihan** (lain): CSV / tampal Google Sheet / URL Apps Script JSON.
  Lajur: `Kelas, Subjek, Guru, Masa, Pecahan, Bilik` (guru kolaborasi dipisah `/`, 1 masa = 30 minit).
- **Terbit**: ke Supabase `tt_terbit` (format `{teachers, classes}` sama seperti `VERSION_DATA.data`),
  atau salin blok `VERSION_DATA` untuk ditampal ke `tools/jadual.html`.

## Agihan Guru Mata Pelajaran (`agihan.html`)

Alamat: `https://skagamamiri.github.io/janajadual/agihan.html`

Menggantikan Google Sheet **AGIHAN JADUAL**. Guna projek Supabase berasingan, **agihan-guru**
(`https://upeohhckgenamwggajip.supabase.co`), dan sudah diisi dengan data sheet (53 guru, 24 kelas, 13 subjek, 384 slot).

- **Agihan**: pilih guru bagi setiap subjek × kelas; jumlah waktu guru dikira serta-merta.
- **Beban Waktu Guru**: waktu seminggu setiap guru, tambah / tukar nama / nyahaktif guru, slip guru.
- **Rumusan Kelas**: guru setiap kelas, guru kelas, matriks semua kelas.
- **Guru Kelas**: grid semua kelas × guru subjek 4 waktu ke atas, dengan dropdown guru kelas di hujung (hanya Pentadbir — dan admin — boleh pilih;
  guru yang mengajar kelas itu disenaraikan dahulu; amaran jika guru kelas tidak mengajar kelas itu atau memegang >1 kelas).
- **Eksport & Cetak**: jam kredit, CSV aSc Timetables, cetakan.

**Log masuk wajib** (Google DELIMa, atau email + kata laluan). Tiga peranan, dikuatkuasakan oleh RLS dalam database:

| Peranan | Boleh |
|---|---|
| **Admin** | Semua: agihan semua subjek, guru kelas, tambah/ubah guru, jam kredit, tetapan, urus pengguna, log |
| **Pentadbir** | Pilih guru kelas (tab Guru Kelas); lihat semua |
| **Ketua Panitia** | Ubah agihan bagi subjek panitia yang ditanda oleh admin; lihat yang lain |
| **Guru** | Lihat sahaja (termasuk kad "Beban waktu anda" dan slip sendiri) |

Tab **Admin** (admin sahaja):
- **Versi agihan** — setiap versi menyimpan agihan & guru kelas sendiri. *Versi semasa* dipaparkan secara lalai
  dan digunakan oleh Jana Jadual. **+ Versi baharu**: *Kosong* (semua slot kosong) atau *Salin* dari versi lain
  (pilihan: kosongkan slot guru tidak aktif — cth. guru berpindah; salin guru kelas). Tindakan lain: Lihat,
  Jadikan semasa, Kunci/Buka kunci (versi dikunci tidak boleh disunting), Nama, Padam (bukan versi semasa).
  Semua pengguna boleh menukar versi yang dilihat melalui pemilih **VERSI** di atas.
- **Mata pelajaran** — senarai subjek bagi setiap tahap, untuk versi yang sedang dipilih:
  **Tahap 1 (KP2027)** = Tahun 1, **Tahap 1** = Tahun 2–3, **Tahap 2** = Tahun 4–6. Setiap subjek ada *waktu seminggu*
  (sama bagi semua kelas dalam tahap), *bilangan guru* (slot; waktu dibahagi sama rata, cth. PI Quran kolaborasi 3 waktu / 3 guru)
  dan tanda *kolaborasi* (tidak dikira dalam jumlah waktu kelas). Tambah/buang subjek, salin senarai dari tahap lain,
  dan daftar subjek baharu dalam *Senarai induk*. Bila disimpan, slot agihan diselaraskan automatik (amaran jika slot berguru akan dibuang).
- **Pengguna & peranan** — tukar peranan, tanda subjek panitia, pautkan kepada nama guru, nyahaktif,
  atau **Daftar pukal** (tampal senarai DELIMa: Nama ⇥ … ⇥ Email).
- **Log perubahan** — siapa ubah apa, bila (termasuk versi).

Aliran bila guru berpindah: Beban Waktu Guru → guru itu → *Tukar nama / status* → nyahtanda Aktif →
Admin → Versi → *Salin* versi semasa dengan "kosongkan slot guru tidak aktif" → ketua panitia isi slot kosong →
*Jadikan semasa* → Jana Jadual → Import agihan → Ambil.

### Persediaan log masuk Google (sekali sahaja, oleh admin)
1. **Google Cloud Console** (console.cloud.google.com, guna akaun DELIMa admin/sekolah) → APIs & Services →
   **OAuth consent screen**: User type *Internal* (hanya akaun moe-dl.edu.my) atau *External*, isi nama aplikasi.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   *Authorized redirect URIs*: `https://upeohhckgenamwggajip.supabase.co/auth/v1/callback`. Salin Client ID & Client secret.
3. **Supabase** → projek *agihan-guru* → **Authentication → Sign In / Providers → Google** → Enable,
   tampal Client ID & secret → Save.
4. **Authentication → URL Configuration**: *Site URL* = `https://skagamamiri.github.io/janajadual/agihan.html`,
   dan tambah URL yang sama dalam *Redirect URLs*.

Sesiapa boleh log masuk dengan Google, tetapi hanya email dalam jadual `pengguna` (aktif) boleh melihat data.

Untuk Jana Jadual: fungsi `agihan_untuk_jana(p_versi)` memberi kelas, subjek, guru & waktu bagi versi semasa (atau versi dipilih); boleh dipanggil dengan kunci anon.

## Peraturan penjana

Wajib: tiada pertembungan guru/kelas/bilik, rehat & waktu tamat ikut tahap, acara tetap
(Kerohanian, PHM), masa guru tidak hadir, kad berkunci tidak diusik, had blok subjek sehari.
Lembut: subjek teras waktu pagi, maks masa berturut guru, beban harian guru seimbang.

Diuji dengan Jadual Versi 4.0 (24 kelas, 52 guru, 746 blok): lengkap tanpa pertembungan dalam 1–4 saat.
