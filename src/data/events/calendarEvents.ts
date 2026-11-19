import type { LifeEvent } from '../../types/game';

const fictional = true;

export const calendarEvents: LifeEvent[] = [
  {
    id: 'calendar-new-year',
    title: 'Awal tahun baru',
    description: 'Pergantian tahun menjadi kesempatan untuk memilih kebiasaan yang ingin kamu bangun.',
    category: 'social',
    calendarMonth: 1,
    calendarMomentType: 'annual',
    minAge: 0,
    maxAge: 120,
    probability: 1,
    cooldownMonths: 12,
    fictional,
    choices: [
      {
        id: 'new-year-health',
        label: 'Menyusun rutinitas sehat',
        description: 'Mengatur waktu istirahat dan kebiasaan yang lebih seimbang.',
        consequence: {
          statChanges: { health: 2, energy: 1, happiness: 1 },
          historyText: 'Memulai tahun dengan rutinitas yang lebih sehat.',
        },
      },
      {
        id: 'new-year-learning',
        label: 'Meluangkan waktu untuk belajar',
        description: 'Menetapkan tujuan belajar dan pengembangan diri.',
        consequence: {
          statChanges: { intelligence: 2, happiness: 1, energy: -1 },
          historyText: 'Menetapkan tujuan belajar untuk tahun ini.',
        },
      },
      {
        id: 'new-year-budget',
        label: 'Mengevaluasi pengeluaran',
        description: 'Meninjau anggaran supaya kebutuhan dan tabungan lebih seimbang.',
        consequence: {
          cashChange: 50_000,
          statChanges: { happiness: 1, wealth: 1 },
          historyText: 'Mengevaluasi anggaran dan menyisihkan dana simulasi.',
        },
      },
    ],
  },
  {
    id: 'calendar-independence-day',
    title: 'Perayaan 17 Agustus',
    description: 'Warga mengadakan kegiatan bersama untuk memperingati Hari Kemerdekaan Indonesia.',
    category: 'social',
    calendarMonth: 8,
    calendarMomentType: 'national',
    countryCode: 'ID',
    minAge: 0,
    maxAge: 120,
    probability: 1,
    cooldownMonths: 12,
    fictional,
    choices: [
      {
        id: 'independence-community',
        label: 'Ikut kegiatan warga',
        description: 'Meluangkan waktu untuk kegiatan kebersamaan di lingkungan.',
        consequence: {
          statChanges: { happiness: 3, reputation: 1, energy: -1 },
          relationshipChanges: [{ role: 'living_family', amount: 1 }],
          historyText: 'Mengikuti kegiatan 17 Agustus bersama warga.',
        },
      },
      {
        id: 'independence-volunteer',
        label: 'Membantu persiapan',
        description: 'Membantu menyiapkan kegiatan bersama dengan biaya kecil.',
        consequence: {
          cashChange: -25_000,
          statChanges: { happiness: 2, reputation: 2, energy: -1 },
          historyText: 'Membantu persiapan kegiatan 17 Agustus.',
        },
      },
      {
        id: 'independence-rest',
        label: 'Beristirahat di rumah',
        description: 'Menikmati waktu tenang dan menjaga tenaga.',
        consequence: {
          statChanges: { health: 1, energy: 2, happiness: 1 },
          historyText: 'Beristirahat saat perayaan 17 Agustus.',
        },
      },
    ],
  },
  {
    id: 'calendar-year-end',
    title: 'Menutup tahun',
    description: 'Akhir tahun mengajakmu melihat kembali kesehatan, kegiatan, dan pengeluaranmu.',
    category: 'social',
    calendarMonth: 12,
    calendarMomentType: 'annual',
    minAge: 0,
    maxAge: 120,
    probability: 1,
    cooldownMonths: 12,
    fictional,
    choices: [
      {
        id: 'year-end-family',
        label: 'Menghabiskan waktu dengan keluarga',
        description: 'Menjaga hubungan melalui waktu dan perhatian.',
        consequence: {
          statChanges: { happiness: 3, energy: -1 },
          relationshipChanges: [{ role: 'living_family', amount: 2 }],
          historyText: 'Menutup tahun dengan meluangkan waktu bersama keluarga.',
        },
      },
      {
        id: 'year-end-health',
        label: 'Memulihkan tenaga',
        description: 'Memberi ruang untuk beristirahat sebelum memulai tahun berikutnya.',
        consequence: {
          statChanges: { health: 2, energy: 2, happiness: 1 },
          historyText: 'Memilih istirahat untuk memulihkan tenaga di akhir tahun.',
        },
      },
      {
        id: 'year-end-budget',
        label: 'Menyusun rencana keuangan',
        description: 'Membuat rencana pengeluaran dan tabungan yang lebih terarah.',
        consequence: {
          cashChange: 25_000,
          statChanges: { intelligence: 1, wealth: 1, happiness: 1 },
          historyText: 'Menyusun rencana keuangan untuk tahun berikutnya.',
        },
      },
    ],
  },
];
