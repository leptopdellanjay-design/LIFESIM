import type { LifeEvent } from '../../types/game';
import { scholarshipEvent } from './scholarship';

export const lifeEvents: LifeEvent[] = [
  {
    id: 'family-care-early-years',
    title: 'Waktu bersama pengasuh',
    description: 'Orang tua atau wali meluangkan waktu untuk menemani karakter di rumah.',
    category: 'family',
    minAge: 0,
    maxAge: 2,
    probability: 0.35,
    once: true,
    fictional: true,
    choices: [
      {
        id: 'share-story',
        label: 'Mendengarkan cerita keluarga',
        description: 'Membangun kedekatan melalui waktu bersama.',
        consequence: {
          statChanges: { happiness: 2 },
          relationshipChanges: [{ role: 'living_family', amount: 2 }],
          historyText: 'Menghabiskan waktu bersama orang tua atau wali.',
        },
      },
      {
        id: 'quiet-play',
        label: 'Bermain dengan tenang',
        description: 'Mengisi waktu dengan permainan sederhana.',
        consequence: {
          statChanges: { energy: 1, happiness: 1 },
          historyText: 'Menikmati waktu bermain di rumah.',
        },
      },
    ],
  },
  {
    id: 'first-school-day',
    title: 'Hari pertama sekolah',
    description: 'Karakter mulai mengenal kegiatan belajar dan lingkungan sekolah.',
    category: 'education',
    minAge: 6,
    maxAge: 6,
    probability: 0.8,
    once: true,
    fictional: true,
    choices: [
      {
        id: 'ask-family-support',
        label: 'Meminta dukungan keluarga',
        description: 'Menghadapi pengalaman baru bersama keluarga.',
        consequence: {
          statChanges: { happiness: 2 },
          relationshipChanges: [{ role: 'living_family', amount: 2 }],
          historyText: 'Memulai sekolah dengan dukungan keluarga.',
        },
      },
      {
        id: 'try-independently',
        label: 'Mencoba dengan mandiri',
        description: 'Berani mencoba rutinitas sekolah yang baru.',
        consequence: {
          statChanges: { intelligence: 1, reputation: 1 },
          historyText: 'Mulai beradaptasi dengan rutinitas sekolah.',
        },
      },
    ],
  },
  {
    id: 'childhood-hobby',
    title: 'Menemukan kegiatan yang disukai',
    description: 'Di luar sekolah, karakter tertarik mencoba kegiatan baru.',
    category: 'random_life',
    minAge: 7,
    maxAge: 12,
    probability: 0.22,
    cooldownYears: 3,
    fictional: true,
    choices: [
      {
        id: 'practice-hobby',
        label: 'Berlatih secara rutin',
        description: 'Meluangkan waktu untuk mengembangkan keterampilan.',
        consequence: {
          statChanges: { intelligence: 2, energy: -1 },
          historyText: 'Berlatih kegiatan yang disukai secara rutin.',
        },
      },
      {
        id: 'share-hobby',
        label: 'Melakukannya bersama keluarga',
        description: 'Berbagi kegiatan dengan anggota keluarga.',
        consequence: {
          statChanges: { happiness: 2 },
          relationshipChanges: [{ role: 'living_family', amount: 1 }],
          historyText: 'Menikmati kegiatan bersama keluarga.',
        },
      },
    ],
  },
  {
    id: 'teenage-interest',
    title: 'Minat baru di masa remaja',
    description: 'Karakter menemukan minat yang ingin ditekuni di luar pelajaran.',
    category: 'random_life',
    minAge: 13,
    maxAge: 17,
    probability: 0.25,
    cooldownYears: 3,
    fictional: true,
    choices: [
      {
        id: 'develop-interest',
        label: 'Mengembangkan minat',
        description: 'Berlatih dan belajar lebih teratur.',
        consequence: {
          statChanges: { intelligence: 2, energy: -1 },
          historyText: 'Mulai menekuni minat pribadi.',
        },
      },
      {
        id: 'balance-study',
        label: 'Menjaga keseimbangan dengan sekolah',
        description: 'Membagi waktu antara minat dan pelajaran.',
        consequence: {
          statChanges: { happiness: 1, intelligence: 1 },
          historyText: 'Menyeimbangkan minat pribadi dengan sekolah.',
        },
      },
    ],
  },
  {
    id: 'first-job-opportunity',
    title: 'Peluang kerja awal',
    description: 'Ada kesempatan mencoba pekerjaan pemula. Pilihan ini membuka pendapatan simulasi pada tahun-tahun berikutnya.',
    category: 'career',
    minAge: 18,
    maxAge: 40,
    probability: 0.3,
    once: true,
    fictional: true,
    occupationRequirement: 'unemployed',
    educationRequirement: ['sma', 'smk'],
    choices: [
      {
        id: 'take-entry-job',
        label: 'Mencoba pekerjaan pemula',
        description: 'Menerima pekerjaan dengan pendapatan dan biaya hidup simulasi.',
        consequence: {
          careerChange: { type: 'hire', occupationId: 'entry-worker' },
          historyText: 'Memulai pekerjaan pemula.',
        },
      },
      {
        id: 'wait-for-opportunity',
        label: 'Menunggu kesempatan lain',
        description: 'Belum mengambil pekerjaan ini.',
        consequence: {
          historyText: 'Memilih menunggu kesempatan kerja lain.',
        },
      },
    ],
  },
  scholarshipEvent,
  {
    id: 'retirement-decision',
    title: 'Menimbang masa pensiun',
    description: 'Setelah bertahun-tahun bekerja, karakter dapat memilih untuk pensiun atau melanjutkan pekerjaan pemula.',
    category: 'career',
    minAge: 60,
    maxAge: 74,
    probability: 0.4,
    once: true,
    fictional: true,
    occupationRequirement: 'employed',
    choices: [
      {
        id: 'retire-now',
        label: 'Memulai masa pensiun',
        description: 'Mengakhiri pekerjaan pemula dan menghentikan pendapatan kerja rutinnya.',
        consequence: {
          careerChange: { type: 'retire' },
          historyText: 'Memulai masa pensiun.',
        },
      },
      {
        id: 'continue-working',
        label: 'Melanjutkan pekerjaan',
        description: 'Tetap bekerja untuk sementara waktu.',
        consequence: {
          historyText: 'Memilih untuk melanjutkan pekerjaan.',
        },
      },
    ],
  },
  {
    id: 'senior-health-check',
    title: 'Memperhatikan kesehatan',
    description: 'Karakter mempertimbangkan cara menjaga kesehatan di usia lanjut.',
    category: 'health',
    minAge: 60,
    maxAge: 74,
    probability: 0.3,
    cooldownYears: 5,
    fictional: true,
    choices: [
      {
        id: 'routine-check',
        label: 'Menjalani pemeriksaan rutin',
        description: 'Menggunakan sebagian saldo untuk pemeriksaan dalam simulasi.',
        minimumCash: 150000,
        consequence: {
          cashChange: -150000,
          statChanges: { health: 2 },
          historyText: 'Menjalani pemeriksaan kesehatan rutin dalam simulasi.',
        },
      },
      {
        id: 'healthy-routine',
        label: 'Menjaga rutinitas harian',
        description: 'Memilih kebiasaan ringan tanpa biaya.',
        consequence: {
          statChanges: { health: 1, energy: 1 },
          historyText: 'Menjaga rutinitas kesehatan sederhana.',
        },
      },
    ],
  },
  {
    id: 'elderly-family-time',
    title: 'Waktu bersama keluarga',
    description: 'Karakter memasuki usia lanjut dan ingin menjaga hubungan dengan keluarga.',
    category: 'family',
    minAge: 75,
    maxAge: Number.MAX_SAFE_INTEGER,
    probability: 0.25,
    cooldownYears: 5,
    fictional: true,
    choices: [
      {
        id: 'family-gathering',
        label: 'Mengadakan waktu berkumpul',
        description: 'Menguatkan hubungan dengan anggota keluarga yang masih hidup.',
        consequence: {
          statChanges: { happiness: 2 },
          relationshipChanges: [{ role: 'living_family', amount: 2 }],
          historyText: 'Menghabiskan waktu berkualitas bersama keluarga.',
        },
      },
      {
        id: 'reflect-on-life',
        label: 'Mengenang perjalanan hidup',
        description: 'Meluangkan waktu untuk refleksi pribadi.',
        consequence: {
          statChanges: { happiness: 1, reputation: 1 },
          historyText: 'Mengenang perjalanan hidup dan pencapaian.',
        },
      },
    ],
  },
];
