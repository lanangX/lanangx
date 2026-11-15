# Setup (Bahasa Indonesia)

1. Di komputer Anda, clone repo `lanangX/lanangx` yang sudah ada, lalu salin SELURUH isi folder ini ke dalamnya (menimpa README lama). Jangan salin `dist-sample/`.
2. Commit dan push ke `main`.
3. Bot memakai GitHub App: pastikan variabel repo `LANANGX_CLIENT_ID` dan secret repo `LANANGX_PRIVATE_KEY` sudah ada, App terpasang di repo `lanangx`, dan izin App **Contents: Read and write**.
4. Tab Actions > workflow `update-profile` > Run workflow. Run pertama membuat branch `assets` berisi WebP, PNG, dan SVG.
5. Buka `github.com/lanangX`. Bila gambar belum muncul, tunggu beberapa menit (cache GitHub) lalu muat ulang.

Data live memakai token App yang dibuat tiap run (kontribusi publik saja). Tidak ada token pribadi yang perlu dibuat.

Uji lokal tanpa jaringan: `npm install --prefix render` lalu `node scripts/generate.mjs --sample sparse --out dist-sample`.
Pratinjau tumpukan README: `node scripts/preview.mjs dist-sample out.png 880`.

Mengubah isi: edit `profile.config.json` (kalimat pengunjung, skill, socials, repo). Jadwal: `.github/workflows/update.yml` (cron harian 03:00 UTC).
