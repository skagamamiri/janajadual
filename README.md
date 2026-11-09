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
- **Import agihan** (Agihan Guru): CSV / tampal Google Sheet / URL Apps Script JSON.
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
- **Eksport & Cetak**: jam kredit, CSV aSc Timetables, cetakan.

Semua orang boleh melihat. Hanya **editor** yang log masuk (email + kata laluan) boleh mengubah —
dikuatkuasakan oleh RLS dalam database. Setiap perubahan direkod dalam `audit_log`.

Persediaan log masuk (sekali sahaja):
1. Supabase → projek *agihan-guru* → **Authentication → Users → Add user** → email + kata laluan,
   tandakan **Auto Confirm User**. (`sab2989@gmail.com` sudah didaftarkan sebagai editor.)
2. (Disyorkan) **Authentication → Sign In / Providers → Email** → matikan *Allow new users to sign up*.
3. Editor lain: cipta akaun di langkah 1, kemudian tambah email dalam agihan.html → ⚙ Tetapan → Editor.

Untuk sistem lain (cth. Jana Jadual): view `v_agihan` memberi `kelas, tahun, tahap, subjek_kod, subjek, slot, guru, waktu`
dan boleh dibaca dengan kunci anon.

## Peraturan penjana

Wajib: tiada pertembungan guru/kelas/bilik, rehat & waktu tamat ikut tahap, acara tetap
(Kerohanian, PHM), masa guru tidak hadir, kad berkunci tidak diusik, had blok subjek sehari.
Lembut: subjek teras waktu pagi, maks masa berturut guru, beban harian guru seimbang.

Diuji dengan Jadual Versi 4.0 (24 kelas, 52 guru, 746 blok): lengkap tanpa pertembungan dalam 1–4 saat.
