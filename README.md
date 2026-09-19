# Bulk SSL Checker & Expiry Monitor

Aplikasi web modern untuk melakukan inspeksi sertifikat SSL/TLS pada banyak domain sekaligus (bulk check), memetakan status masa aktif (**Perlu Diperbarui Tahun Ini** vs **Masih Aman s.d Tahun Depan+**), serta mengekspor laporan lengkap ke Microsoft Excel (.xlsx) dan CSV.

## Fitur Utama
- **Bulk Domain Inspection**: Input puluhan hingga ratusan link/domain sekaligus (paste teks atau upload file `.txt`/`.csv`).
- **Evaluasi Masa Aktif Dinamis**:
  - `✅ Masih Aman (s.d Tahun Depan+)`: Sertifikat aktif melampaui akhir tahun berjalan.
  - `⚠️ Perlu Diperbarui Tahun Ini`: Sertifikat akan kedaluwarsa sebelum pergantian tahun.
  - `❌ Sudah Kedaluwarsa / Error`: Sertifikat telah kedaluwarsa atau domain gagal koneksi.
- **Informasi SSL Lengkap**: Issuer (Organisasi & CN), Subject CN, Subject Alternative Names (SAN), Protokol TLS (TLSv1.3/TLSv1.2), Cipher Suite, Sisa Hari, Tanggal Mulai/Expired, Fingerprint SHA-256, dan Serial Number.
- **Ekspor Excel (.xlsx) & CSV**:
  - Format tabel profesional dengan header Navy gelap dan freeze row.
  - Pewarnaan sel otomatis (Hijau untuk aman tahun depan+, Kuning untuk update tahun ini, Merah untuk expired/error).
  - Ekspor CSV untuk integrasi mudah ke Google Sheets.
- **UI Dashboard Responsif**: Dark-mode glassmorphism dengan metrik statistik dan filter interaktif.

## Cara Menjalankan

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)
- npm

### Instalasi & Menjalankan
1. Clone repositori:
   ```bash
   git clone <URL_REPO_ANDA>
   cd ssl-checker
   ```
2. Install dependensi:
   ```bash
   npm install
   ```
3. Jalankan aplikasi:
   ```bash
   npm start
   ```
4. Buka di browser:
   ```
   http://localhost:3000
   ```

## Struktur Project
```
ssl-checker/
├── public/
│   ├── index.html      # Antarmuka web utama
│   ├── style.css       # Styling tema dark modern & responsive
│   └── app.js          # Logika frontend & ekspor
├── sslChecker.js       # Engine soket TLS & inspeksi sertifikat
├── excelExporter.js    # Generator file Excel (.xlsx) dengan conditional formatting
├── server.js           # Express API server & static server
├── package.json
└── README.md
```
