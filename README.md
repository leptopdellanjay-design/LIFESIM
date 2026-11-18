# INDOLIFE — Indonesian Life Simulator

Game simulasi kehidupan Indonesia 2D berbasis teks, ilustrasi orisinal, pilihan, statistik, dan riwayat hidup.

## Teknologi
- React + TypeScript + Vite
- Zustand untuk state gameplay
- Dexie/IndexedDB untuk simpanan lokal satu slot
- Vitest untuk pengujian
- Target Android melalui Capacitor pada fase berikutnya

## Menjalankan
```bash
npm install
npm run dev
```

## Pemeriksaan
```bash
npm test
npm run build
```

## Fitur saat ini
- Pembuatan karakter bertahap dengan validasi identitas, tanggal dan lokasi lahir, latar ekonomi, keluarga, serta kepribadian.
- Statistik awal, keluarga, dan aset diturunkan dari pilihan pemain; peristiwa kelahiran dicatat dan memengaruhi kebahagiaan awal.
- Age Up menjalankan satu siklus tahunan: perkembangan statistik, tahap hidup, pendidikan, ekonomi pekerjaan, hubungan keluarga, event, kesehatan, dan risiko kematian.
- Sembilan tahap kehidupan berubah otomatis berdasarkan usia; setiap tahun dan milestone tercatat dalam riwayat.
- Katalog memuat 40+ event unik dalam 13 kategori, dengan syarat usia, tahun, lokasi, statistik, keluarga, ekonomi, hubungan, pekerjaan, hukum, dan organisasi.
- Event menggunakan peluang berbobot yang dapat diuji deterministik, cooldown, riwayat pilihan, pencegahan duplikasi, event lanjutan, dan konsekuensi tertunda.
- Konsekuensi dapat mengubah statistik, uang, utang, aset, pendidikan, pekerjaan, keluarga, relasi sosial, status pernikahan, status hukum, dan keanggotaan organisasi.
- Event fiksi diberi label; event sejarah faktual diberi klasifikasi dan sumber. Event organisasi bawah tanah merupakan narasi fiksi non-operasional.
- Konteks teknologi mengikuti tahun permainan; smartphone tidak tersedia sebelum 2007. Tahun setelah 2026 diberi label masa depan fiksi.
- Pendidikan memiliki katalog sekolah/program tinggi fiktif Indonesia, nilai semester dan IPK, biaya sesuai era, beasiswa, cuti, transfer, kelulusan, gelar, penghargaan akademik, dan riwayat.
- Karier memiliki katalog profesi dan pemberi kerja fiktif, kualifikasi, lamaran/tawaran, gaji, pengalaman, promosi, PHK, dan pensiun; pendapatan tahunan masuk ke saldo serta kekayaan bersih.
- Event pendidikan dan karier memakai syarat record akademik/profesional yang sesungguhnya, termasuk peringatan akademik, evaluasi gaji, promosi, dan pengakuan akademik.
- Hubungan sosial mendukung kenalan, interaksi, rekonsiliasi, pertemanan, tahap berpacaran, pertunangan, pernikahan, dan perceraian dengan dampak pada relasi, kebahagiaan, saldo, dan riwayat.
- Sistem keluarga mencatat orang tua, saudara, wali, kakek/nenek yang belum diketahui, pasangan, serta anak dalam silsilah dan riwayat yang tersimpan.
- Pemain yang telah menikah dapat memiliki atau mengadopsi anak, memilih pola asuh, berinteraksi dengan anak, dan menjalani perkembangan pendidikan, kesehatan, hubungan, serta biaya pengasuhan per tahun.
- Kematian NPC diproses dengan risiko tahunan deterministik berdasarkan usia dan kesehatan; warisan orang tua hanya dibagikan jika nilai harta tercatat, dan status pasangan yang meninggal menjadi duda/janda.
- Keuangan mendukung anggaran rumah tangga yang digunakan pada Age Up, deposito dan reksa dana simulasi, pinjaman berbunga dengan cicilan tahunan, serta riwayat transaksi.
- Usaha kecil memiliki modal awal, omzet, biaya operasional, stabilitas, nilai aset, dan opsi tutup; hasil tahunan bergantung pada kondisi pasar simulasi.
- Properti rumah, kontrakan, dan tanah dapat dibeli atau dijual. Kontrakan menghasilkan pendapatan sewa; seluruh properti mengalami biaya pemeliharaan dan perubahan nilai tahunan.
- Simpanan lokal satu slot memakai versi 6 IndexedDB dan migrasi aditif dari versi 1–5; record hubungan, anak, dan ekonomi lama dilengkapi tanpa menghapus riwayat.
- Age Up menulis hasil simulasi sebelum memperbarui state, mencegah klik ganda, dan mempertahankan state jika autosave gagal.
- Profil karakter dapat diedit tanpa mengatur ulang kemajuan hidup.
- Dashboard menampilkan tahap usia, event aktif, loading/error state, dan ringkasan kematian.
- Pendidikan, karier, hubungan keluarga, keuangan simulasi, dan riwayat terhubung ke satu Zustand store.

Nilai ekonomi, hasil investasi, dan risiko kematian adalah aturan fiksi simulasi, bukan data historis, penawaran kredit, atau prediksi faktual. Pilihan lokasi yang tersedia saat ini adalah Indonesia; konfigurasi pendidikan dan karier negara lain belum tersedia. Nama kerabat yang tidak diketahui tetap ditandai sebagai tidak diketahui, bukan dianggap fakta silsilah. Generasi turunan yang dapat dimainkan, cucu, pembagian warisan kompleks, dan sistem hukum rinci masih dalam pengembangan. Tidak ada simulasi sejarah faktual personal di luar konteks event yang secara eksplisit bersumber.

## Prinsip
- Bukan game 3D/open-world.
- Event dan konsekuensi harus benar-benar mengubah state.
- Pisahkan engine, data, UI, dan persistence.
- Jangan mengklaim fitur selesai sebelum diuji.
- Simpanan lokal tidak dihapus atau diganti saat karakter baru dibuat jika save aktif sudah tersedia.
