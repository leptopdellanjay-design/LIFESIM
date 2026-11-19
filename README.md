# INDOLIFE — Indonesian Life Simulator

Game simulasi kehidupan Indonesia 2D berbasis teks, ilustrasi orisinal, pilihan, statistik, dan riwayat hidup.

## Teknologi
- React + TypeScript + Vite
- Zustand untuk state gameplay
- Dexie/IndexedDB untuk beberapa slot simpanan lokal dan backup JSON
- Vitest untuk pengujian
- Capacitor untuk aplikasi Android

## Menjalankan
Persyaratan: Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

## Android
Persyaratan: Android Studio, Android SDK 36, dan JDK 21.

```bash
npm run android:sync
npm run android:open
```

Jalankan aplikasi pada emulator/perangkat dari Android Studio. Untuk menjalankan langsung pada perangkat yang terhubung, gunakan `npm run android:run`. APK debug dapat dibuat dengan `cd android && ./gradlew assembleDebug` (Windows: `cd android; .\gradlew.bat assembleDebug`).

## Pemeriksaan
```bash
npm test
npm run build
```

## Deployment GitHub Pages
- Workflow `.github/workflows/deploy.yml` menjalankan seluruh tes dan membuat build Vite untuk repository `LIFESIM` setiap ada push ke `main`.
- Untuk deployment, buka **Settings → Pages → Build and deployment → Source**, lalu pilih **GitHub Actions**. Workflow mengunggah folder `dist` dan menerbitkan hasilnya ke GitHub Pages.
- Build lokal biasa memakai root path. Mode `github-pages` membangun aset dengan base `/LIFESIM/`.
- Workflow juga membangun APK Android debug untuk memverifikasi integrasi Capacitor.

## Fitur saat ini
- Pembuatan karakter bertahap dengan validasi identitas, tanggal dan lokasi lahir, latar ekonomi, keluarga, serta kepribadian.
- Permainan baru dimulai saat karakter berusia 18 tahun dan telah lulus SMA/SMK. Pemain harus memilih kuliah, kerja, atau gap year sebelum waktu dapat berjalan.
- Jalur kuliah menyediakan pilihan kampus nyata Universitas Indonesia, Universitas Gadjah Mada, dan IPB University beserta tautan resmi. Bimbel berbayar dan belajar mandiri meningkatkan persiapan; tes masuk, nilai ambang, dan hasil penerimaan adalah simulasi, bukan informasi seleksi resmi.
- Orang tua yang masih hidup mendapat pekerjaan acak yang sesuai dengan tingkat ekonomi keluarga. Mereka mengirim dukungan bulanan selama karakter berusia di bawah 18 tahun; jumlahnya mengikuti pekerjaan, jumlah orang tua yang hidup, dan kondisi keluarga, lalu dicatat sebagai pemasukan.
- Statistik awal, keluarga, dan aset diturunkan dari pilihan pemain; peristiwa kelahiran dicatat dan memengaruhi kebahagiaan awal.
- Pemain dapat memajukan satu bulan atau menjalankan hingga satu tahun (maksimal 12 bulan). Simulasi setahun berhenti saat ada event yang perlu dipilih atau kehidupan berakhir; sisa bulan disimpan dan dapat dilanjutkan setelah pilihan event dibuat. Umur bertambah pada bulan ulang tahun; pendidikan, kesehatan, karier, pemasukan, pengeluaran, aset, risiko kematian, dan event berjalan menurut periode yang sesuai.
- Kalender menandai Januari, perayaan 17 Agustus, dan akhir tahun; event acak dapat muncul sepanjang tahun dan harus dipilih sebelum waktu bergerak lagi.
- Sembilan tahap kehidupan berubah otomatis berdasarkan usia; bulan, tahun, ulang tahun, dan milestone tercatat dalam riwayat.
- Katalog memuat 50+ event unik dalam 13 kategori, dengan syarat usia, tahun, lokasi, statistik, keluarga, ekonomi, hubungan, pekerjaan, hukum, dan organisasi.
- Event menggunakan peluang berbobot yang dapat diuji deterministik, cooldown, riwayat pilihan, pencegahan duplikasi, event lanjutan, dan konsekuensi tertunda.
- Konsekuensi dapat mengubah statistik, uang, utang, aset, pendidikan, pekerjaan, keluarga, relasi sosial, status pernikahan, status hukum, keanggotaan organisasi, serta audiens akun digital.
- Dashboard karakter hidup menampilkan estimasi usia harapan hidup, rentang probabilitas, risiko tahunan saat ini, dan faktor kesehatan/ekonomi yang berpengaruh. Setelah kematian, ringkasan menampilkan harta bersih, pendidikan, karier, dan keluarga; estimasi tidak menjanjikan usia atau tanggal kematian.
- Event fiksi diberi label; tujuh konteks sejarah faktual memiliki klasifikasi dan sumber institusional. Event organisasi bawah tanah merupakan narasi fiksi non-operasional.
- Konteks teknologi mengikuti tahun permainan; smartphone tidak tersedia sebelum 2007. Tahun setelah 2026 diberi label masa depan fiksi.
- Kehidupan digital menyediakan katalog ponsel dan peralatan kreator sesuai tahun rilis, pembelian/tukar tambah/jual perangkat, paket data bulanan, serta aplikasi Jaringan, Kamera & Studio, Pasar Digital, dan Dompet. Ponsel/peralatan menjadi aset yang menyusut nilainya melalui simulasi ekonomi.
- Akun sosial fiktif dapat dibuat mulai usia 13 tahun. Unggahan memakai kuota data dan biaya produksi, menghasilkan tayangan/interaksi/audiens secara simulasi, mengurangi energi, dan konten populer dapat meningkatkan kebahagiaan, reputasi sosial, serta reputasi profesional.
- Skill kreator meningkat dari aktivitas konten. Gelar kreator seperti Kreator Pemula hingga Ikon Digital tersimpan permanen setelah syarat jumlah konten, audiens, tayangan, engagement, dan pendapatan terpenuhi; gelar dan skill tampil di halaman digital.
- Monetisasi kreator terbuka setelah memenuhi syarat audiens dan tayangan tiap platform. Tawaran sponsor dan kritik privasi hanya muncul sesuai kondisi akun, lalu konsekuensinya mengubah pendapatan, reputasi, dan audiens.
- Perbankan fiktif menyediakan beberapa bank, pembukaan rekening, setor/tarik tunai, transfer antar rekening, biaya layanan, dan bunga tabungan bulanan. Saldo bank dicatat sebagai aset simpanan yang berpasangan dengan rekening sehingga tidak menggandakan kekayaan bersih; transaksi dan bunga tercatat dalam riwayat digital/ekonomi. Tidak ada transaksi jaringan nyata.
- Pendidikan memiliki katalog sekolah dan program studi simulasi dari D1 hingga doktor, termasuk magister dan doktor, nilai semester dan IPK, biaya, beasiswa, cuti, transfer, kelulusan, gelar, serta dampak studi pada kecerdasan, kesehatan, energi, dan kebahagiaan. Gelar yang diperoleh tampil pada nama karakter di dashboard.
- Karier memiliki katalog profesi dan pemberi kerja fiktif, kualifikasi, lamaran/tawaran, gaji bulanan, pengalaman, promosi, PHK, dan pensiun; pemasukan dan pengeluaran diperbarui setiap bulan.
- Event pendidikan dan karier memakai syarat record akademik/profesional yang sesungguhnya, termasuk peringatan akademik, evaluasi gaji, promosi, dan pengakuan akademik.
- Hubungan sosial mendukung kenalan, interaksi, rekonsiliasi, pertemanan, tahap berpacaran, pertunangan, pernikahan, dan perceraian dengan dampak pada relasi, kebahagiaan, saldo, dan riwayat.
- Sistem keluarga mencatat orang tua, saudara, wali, kakek/nenek yang belum diketahui, pasangan, serta anak dalam silsilah dan riwayat yang tersimpan.
- Pemain yang telah menikah dapat memiliki atau mengadopsi anak, memilih pola asuh, berinteraksi dengan anak, dan menjalani perkembangan pendidikan, kesehatan, hubungan, serta biaya pengasuhan.
- Kematian NPC diproses berdasarkan usia dan kesehatan; karakter dewasa dapat mengatur pembagian estate simulasi, membayar utang dari harta, dan memilih penerus. Setelah karakter meninggal, pemain dapat melanjutkan sebagai anak dewasa yang dipilih; silsilah dan bagian waris tercatat lintas generasi.
- Keuangan mendukung anggaran rumah tangga bulanan, deposito dan reksa dana simulasi, pinjaman berbunga dengan cicilan bulanan, serta riwayat transaksi. Anggaran kesehatan/makanan, pendidikan, dan rekreasi yang terbayar memengaruhi kesehatan, kecerdasan, dan kebahagiaan secara berkala.
- Usaha kecil memiliki modal awal, omzet, biaya operasional, stabilitas, nilai aset, dan opsi tutup; hasil usaha diperbarui tiap bulan sesuai kondisi pasar simulasi.
- Properti rumah, kontrakan, dan tanah dapat dibeli atau dijual. Kontrakan menghasilkan pendapatan sewa dan properti membebankan biaya pemeliharaan bulanan.
- Simpanan lokal multi-slot memakai skema IndexedDB versi 13; migrasi aditif mempertahankan slot lama, tanggal bulanan, silsilah, estate, pekerjaan orang tua, dan catatan permainan, serta menginisialisasi progres kreator, rekening, dan pilihan pasca-SMA untuk save lama. Backup JSON tetap memakai format versi 6 dan menerima save lama tanpa data digital.
- Pengaturan memungkinkan beralih cerita, memulai cerita baru tanpa mengganti slot lama, mengunduh backup JSON, dan memulihkan backup ke slot yang dipilih. File yang dipulihkan divalidasi dan dibatasi 10 MB.
- Cloud-save belum dikonfigurasi; tetap opsional agar permainan offline tersedia tanpa akun atau kredensial layanan.
- Giliran bulanan ditulis ke simpanan sebelum memperbarui state, mencegah klik ganda, dan mempertahankan state jika autosave gagal.
- Profil karakter dapat diedit tanpa mengatur ulang kemajuan hidup.
- Dashboard menampilkan kalender bulan berjalan, tahap usia, estimasi lifespan, event aktif, gelar akademik, loading/error state, dan ringkasan kematian; navigasi utama disembunyikan di menu sandwich. Tampilan ponsel memakai dock bawah dan lembar aktivitas, sedangkan halaman digital menampilkan mockup perangkat dengan aplikasi yang dapat dibuka.
- Daftar hubungan menyembunyikan hubungan yang berakhir dan menempatkan pasangan yang masih menjadi suami/istri di urutan teratas.
- Pendidikan, karier, hubungan keluarga, keuangan simulasi, dan riwayat terhubung ke satu Zustand store.

Nilai ekonomi, pembagian estate, hasil investasi, dan risiko kematian adalah aturan fiksi simulasi, bukan data historis, nasihat hukum/keuangan, atau prediksi faktual. Pilihan lokasi yang tersedia saat ini adalah Indonesia dengan 38 provinsi; konfigurasi pendidikan dan karier negara lain belum tersedia. Nama kerabat yang tidak diketahui tetap ditandai sebagai tidak diketahui, bukan dianggap fakta silsilah. Penerus baru dapat dimainkan setelah berusia 18 tahun; bila tidak ada anak dewasa, kehidupan berakhir dan pemain dapat memulai slot baru. Sistem estate hanya simulasi permainan dan tidak menafsirkan hukum waris nyata.

## Status roadmap
1-8. Fondasi, dashboard, karakter, simulasi bulanan, event, pendidikan/karier, relasi/keluarga, ekonomi/properti — selesai.
9. Sejarah dan wilayah Indonesia — selesai untuk cakupan saat ini: 38 provinsi, kota pilihan, dan konteks sejarah bersumber yang terpisah dari fiksi.
10. Mafia dan dunia bawah — selesai sebagai narasi fiksi abstrak/non-operasional.
11. Kematian, warisan, generasi — selesai untuk risiko kematian, rencana dan pembagian estate simulasi, pewaris dewasa, serta pergantian karakter lintas generasi.
12. Simpanan lokal dan cloud opsional — multi-slot, backup/restore, dan migrasi lokal selesai; cloud tetap opsional dan belum diaktifkan tanpa konfigurasi layanan.
13. Build Web dan Android — selesai; GitHub Actions membangun situs dan APK Android debug.
14–18. Smartphone, aplikasi digital, media sosial, kreator, monetisasi, marketplace awal, dan perbankan fiktif — slice fungsional tersedia; skill/title kreator, saldo rekening, transfer, bunga, reputasi, aset, dan arus kas terhubung serta memiliki pengujian persistensi.
19–20. Event khusus digital dan sponsor — event sponsor/privasi berbasis kondisi akun telah tersedia; karier digital lanjutan dan sistem perusahaan/platform masih belum selesai.
21–30. Ekspansi lanjutan pada cakupan lampiran (termasuk fitur perjalanan, perusahaan, kendaraan, achievement, dan optimasi) — belum selesai; perlu diaudit dan dikerjakan bertahap.

## Prinsip
- Bukan game 3D/open-world.
- Event dan konsekuensi harus benar-benar mengubah state.
- Pisahkan engine, data, UI, dan persistence.
- Jangan mengklaim fitur selesai sebelum diuji.
- Simpanan lokal tidak dihapus atau diganti saat karakter baru dibuat jika save aktif sudah tersedia.
