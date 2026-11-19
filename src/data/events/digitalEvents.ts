import type { LifeEvent } from '../../types/game';

export const digitalEvents: LifeEvent[] = [
  {
    id: 'digital-sponsored-campaign',
    title: 'Tawaran kerja sama merek',
    description: 'Sebuah merek menghubungi akunmu. Kontrak memberi pemasukan dan jangkauan, tetapi promosi harus tetap jujur kepada audiens.',
    category: 'career',
    minAge: 18,
    maxAge: 99,
    minYear: 2007,
    minDigitalAudience: 1_000,
    requiresMonetizedDigitalAccount: true,
    probability: 0.12,
    cooldownMonths: 24,
    choices: [
      {
        id: 'digital-sponsor-disclosed',
        label: 'Terima dan tandai sebagai sponsor',
        description: 'Dapatkan bayaran, jaga transparansi, dan dorong pertumbuhan akun.',
        consequence: {
          incomeChange: 1_500_000,
          statChanges: { reputation: 2, happiness: 1 },
          digitalAccountEffects: [{
            monetizedOnly: true,
            audienceChange: 250,
            totalViewsChange: 25_000,
          }],
          historyText: 'Menyelesaikan kerja sama sponsor secara transparan; pendapatan dan audiens digital meningkat.',
        },
      },
      {
        id: 'digital-sponsor-premium',
        label: 'Negosiasikan paket kampanye besar',
        description: 'Gunakan jangkauan akun yang sudah luas untuk menegosiasikan kontrak bernilai tinggi.',
        requirements: {
          requiresMonetizedDigitalAccount: true,
          minDigitalAudience: 100_000,
        },
        consequence: {
          incomeChange: 6_000_000,
          statChanges: { reputation: 3 },
          digitalAccountEffects: [{
            monetizedOnly: true,
            audienceChange: 1_000,
            totalViewsChange: 100_000,
          }],
          historyText: 'Menegosiasikan kampanye sponsor besar dengan transparansi; pendapatan dan jangkauan kreator meningkat.',
        },
      },
      {
        id: 'digital-sponsor-decline',
        label: 'Tolak tawaran',
        description: 'Jaga independensi konten tanpa menerima bayaran sponsor.',
        consequence: {
          statChanges: { happiness: 1 },
          historyText: 'Menolak kerja sama sponsor yang tidak sesuai dengan arah konten.',
        },
      },
    ],
  },
  {
    id: 'digital-privacy-backlash',
    title: 'Kritik soal privasi di media sosial',
    description: 'Sebuah unggahan lama memicu diskusi tentang privasi dan cara kamu berinteraksi dengan audiens.',
    category: 'social',
    minAge: 13,
    maxAge: 99,
    minYear: 2007,
    minDigitalAudience: 500,
    probability: 0.08,
    cooldownMonths: 36,
    choices: [
      {
        id: 'digital-privacy-respond',
        label: 'Tanggapi dengan terbuka',
        description: 'Jelaskan konteks dan perbarui kebiasaan berbagi.',
        consequence: {
          statChanges: { reputation: 2, happiness: -1 },
          digitalAccountEffects: [{ audienceChange: 50, totalViewsChange: 5_000 }],
          historyText: 'Menanggapi kritik privasi secara terbuka; reputasi dan kepercayaan audiens pulih.',
        },
      },
      {
        id: 'digital-privacy-ignore',
        label: 'Abaikan kritik',
        description: 'Pertahankan unggahan, tetapi sebagian audiens memilih pergi.',
        consequence: {
          statChanges: { reputation: -4, happiness: -2 },
          digitalAccountEffects: [{ audienceChange: -300 }],
          historyText: 'Mengabaikan kritik privasi; reputasi dan sebagian audiens menurun.',
        },
      },
    ],
  },
];
