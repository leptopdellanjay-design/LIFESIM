# MASTER PROMPT — INDOLIFE

Bertindak sebagai Senior Game Developer dan Software Architect. Kembangkan repository ini menjadi INDOLIFE — Indonesian Life Simulator untuk Web dan Android.

## Konsep
Game simulasi kehidupan 2D berbasis teks, ilustrasi, pilihan interaktif, statistik, dan event. Terinspirasi dari genre life simulator, tetapi seluruh kode, narasi, desain, dan aset harus orisinal. Bukan game 3D atau open-world.

## Teknologi
React, TypeScript, Vite, Zustand, Dexie.js, Vitest. Untuk Android, evaluasi dan integrasikan Capacitor pada fase platform. Supabase hanya pada fase cloud-save dan harus tetap opsional agar game offline tetap bisa dimainkan.

## Aturan kerja
1. Audit repository sebelum mengubah file.
2. Pertahankan kode yang sudah berfungsi.
3. Jangan membuat tombol palsu atau fitur pajangan.
4. Pisahkan UI, engine, data, store, dan persistence.
5. Implementasikan satu fase pada satu waktu.
6. Setelah setiap fase jalankan typecheck/build/test dan perbaiki error.
7. Laporkan file yang dibuat/diubah, fitur yang berfungsi, hasil test, dan pekerjaan tersisa.
8. Jangan menyalin aset, teks, merek, atau konten proprietary game lain.

## Sistem wajib
- Character creation: nama, gender, tahun/tempat lahir, keluarga, latar ekonomi.
- Age-up: tambah satu tahun, proses pendidikan/pekerjaan/keuangan/relasi/event, simpan riwayat.
- Statistik: health, happiness, intelligence, looks, energy, reputation, wealth.
- Event engine berbasis data: kategori, syarat usia, prasyarat, bobot, pilihan, efek, dan event lanjutan.
- Consequence engine: perubahan statistik, saldo, pendidikan, karier, relasi, status, dan unlock.
- Event berantai dengan pencegahan duplikasi dan validasi kondisi.
- Pendidikan Indonesia, pekerjaan, keluarga, percintaan, kesehatan, keuangan Rupiah, properti, sejarah sesuai periode, kematian, warisan, dan generasi.
- Life history/timeline.
- Autosave, beberapa slot save, backup/restore, migrasi data.
- Web responsif dan Android via Capacitor.

## Konten awal
Mulai dengan 50 event berkualitas, tetapi jangan mengorbankan validitas sistem demi jumlah. Pisahkan fakta sejarah terverifikasi dari fiksi. Jangan menyajikan peristiwa fiksi sebagai sejarah faktual.

## Roadmap
1. Audit dan fondasi.
2. UI/UX dashboard.
3. Character creation.
4. Life simulation dan age-up.
5. Event/consequence engine.
6. Pendidikan dan karier.
7. Keluarga dan relasi.
8. Ekonomi dan properti.
9. Sejarah dan wilayah Indonesia.
10. Mafia & Criminal Underworld System
11. Kematian, warisan, generasi.
12. Save lokal dan cloud opsional.
13. Build Web dan Android.

## Tugas pertama
Audit seluruh repository. Jelaskan kondisi dan rencana singkat. Jalankan aplikasi starter, periksa build/test, lalu lanjutkan hanya ke fondasi yang belum tersedia. Jangan langsung membangun seluruh game sekaligus.
