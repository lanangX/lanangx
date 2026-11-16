# Setup (Bahasa Indonesia)

1. Siapkan bot (GitHub App) lebih dulu, sebelum push: variabel repo `LANANGX_CLIENT_ID`, secret repo `LANANGX_PRIVATE_KEY`, App terpasang di repo `lanangx`, izin App **Contents: Read and write**.
2. Di komputer Anda, clone repo `lanangX/lanangx` yang sudah ada, lalu salin SELURUH isi folder ini ke dalamnya (menimpa README lama). Jangan salin `dist-sample/`.
3. Commit dan push ke `main`.
4. Push ke `main` memicu workflow `update-profile` OTOMATIS (tab Actions, label "pushed by"). Tidak perlu menekan Run workflow. Run pertama membuat branch `assets` berisi WebP, PNG, SVG, dan `hashes.json`. Run manual hanya bila tidak ada run yang muncul atau Anda ingin memaksa pembaruan.
5. Buka `github.com/lanangX`. Bila gambar belum muncul, tunggu beberapa menit (cache GitHub) lalu muat ulang.

## Cara kerja singkat

- Branch `main` berisi kode, config, dan README.
- Branch `assets` berisi hasil render dan dibuat ulang otomatis sebagai satu commit tiap run. Jangan merge atau hapus; bila dihapus, gambar di profil 404 sampai run berikutnya.
- Pemicu run: push ke file yang relevan (`push`), jadwal harian 03:00 UTC (`schedule`), dan tombol Run workflow (`workflow_dispatch`, label "Manually run").
- Scene 3D hanya dirender ulang bila datanya berubah; SVG dan footer selalu dibuat ulang.

Data live memakai token App yang dibuat tiap run (kontribusi publik saja). Tidak ada token pribadi yang perlu dibuat.

Uji lokal tanpa jaringan: `npm install --prefix render` lalu `node scripts/generate.mjs --sample sparse --out dist-sample`.
Pratinjau tumpukan README: `node scripts/preview.mjs dist-sample out.png 880`.

Mengubah isi: edit `profile.config.json` (kalimat pengunjung, skill, socials, repo). Jadwal: `.github/workflows/update.yml`.
