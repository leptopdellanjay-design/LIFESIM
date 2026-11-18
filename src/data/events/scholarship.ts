import type { LifeEvent } from '../../types/game';

export const scholarshipEvent: LifeEvent = {
  id: 'education-scholarship-001',
  title: 'Kesempatan Mendapatkan Beasiswa',
  description:
    'Kamu baru lulus SMA. Nilaimu cukup baik, tetapi kondisi ekonomi keluarga belum memungkinkan untuk membiayai kuliah. Kamu bisa mencoba mencari beasiswa.',
  category: 'education',
  minAge: 18,
  maxAge: 22,
  minYear: 1950,
  maxYear: 2100,
  countryCode: 'ID',
  educationRequirement: ['sma', 'smk'],
  probability: 0.3,
  cooldownYears: 5,
  once: true,
  fictional: true,
  choices: [
    {
      id: 'scholarship',
      label: 'Mencari beasiswa',
      description: 'Menyiapkan dokumen dan mengikuti seleksi beasiswa.',
      consequence: {
        statChanges: { intelligence: 2, energy: -3 },
        scholarshipChanges: [{
          id: 'bantuan-ekonomi:phase5-event',
          scholarshipId: 'bantuan-ekonomi',
          name: 'Bantuan Pendidikan Ekonomi',
          type: 'economic_aid',
          status: 'applied',
          tuitionCoveragePercent: 70,
          stipendPerSemester: 500000,
          remainingSemesters: 8,
          appliedYear: 0,
          minimumGpa: 2,
        }],
        historyText: 'Memutuskan untuk berjuang mendapatkan beasiswa.',
      },
    },
    {
      id: 'work',
      label: 'Langsung bekerja',
      description: 'Mencari pekerjaan untuk membantu ekonomi keluarga.',
      consequence: {
        careerChange: { type: 'hire', occupationId: 'entry-worker' },
        historyText: 'Memutuskan untuk langsung bekerja setelah SMA.',
      },
    },
    {
      id: 'loan',
      label: 'Mencari pinjaman pendidikan',
      description: 'Mencari bantuan dana untuk membiayai kuliah.',
      consequence: {
        cashChange: 0,
        historyText: 'Memutuskan mencari pembiayaan untuk melanjutkan kuliah.',
      },
    },
  ],
};
