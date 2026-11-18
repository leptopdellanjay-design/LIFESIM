import type {
  EducationLevel,
  ScholarshipDefinition,
  StudyProgram,
  University,
} from '../types/game';

export interface EducationLevelConfiguration {
  level: EducationLevel;
  label: string;
  durationYears: number;
  approximateEntryAge: number;
  entryLevels: EducationLevel[];
  annualTuition: number;
  countryCode: string;
}

export interface EducationCountryConfiguration {
  countryCode: string;
  currencyCode: string;
  gpaMaximum: number;
  minimumPassingGpa: number;
  taxRate: number;
}

export const educationCountries: Record<string, EducationCountryConfiguration> = {
  ID: {
    countryCode: 'ID',
    currencyCode: 'IDR',
    gpaMaximum: 4,
    minimumPassingGpa: 2,
    taxRate: 0.05,
  },
};

export const educationLevelConfigurations: EducationLevelConfiguration[] = [
  { countryCode: 'ID', level: 'paud', label: 'PAUD', durationYears: 1, approximateEntryAge: 3, entryLevels: ['none'], annualTuition: 800_000 },
  { countryCode: 'ID', level: 'tk', label: 'Taman Kanak-kanak', durationYears: 2, approximateEntryAge: 4, entryLevels: ['paud', 'none'], annualTuition: 1_200_000 },
  { countryCode: 'ID', level: 'sd', label: 'Sekolah Dasar', durationYears: 6, approximateEntryAge: 6, entryLevels: ['tk', 'none'], annualTuition: 1_500_000 },
  { countryCode: 'ID', level: 'smp', label: 'Sekolah Menengah Pertama', durationYears: 3, approximateEntryAge: 12, entryLevels: ['sd'], annualTuition: 2_000_000 },
  { countryCode: 'ID', level: 'sma', label: 'Sekolah Menengah Atas', durationYears: 3, approximateEntryAge: 15, entryLevels: ['smp'], annualTuition: 3_000_000 },
  { countryCode: 'ID', level: 'smk', label: 'Sekolah Menengah Kejuruan', durationYears: 3, approximateEntryAge: 15, entryLevels: ['smp'], annualTuition: 3_500_000 },
];

const courseNames: Record<string, string[]> = {
  accounting: ['Pengantar Akuntansi', 'Ekonomi Mikro', 'Matematika Bisnis', 'Etika Profesi'],
  business: ['Dasar Manajemen', 'Komunikasi Bisnis', 'Pengantar Ekonomi', 'Analisis Organisasi'],
  medicine: ['Biologi Manusia', 'Anatomi Dasar', 'Kesehatan Masyarakat', 'Etika Kedokteran'],
  law: ['Pengantar Hukum', 'Hukum Tata Negara', 'Etika Hukum', 'Penalaran Hukum'],
  engineering: ['Matematika Teknik', 'Fisika Terapan', 'Desain Rekayasa', 'Etika Profesi'],
  informatics: ['Algoritma', 'Sistem Komputer', 'Basis Data', 'Etika Teknologi'],
  education: ['Psikologi Belajar', 'Strategi Pembelajaran', 'Kurikulum', 'Praktik Mengajar'],
  psychology: ['Psikologi Umum', 'Metode Penelitian', 'Psikologi Sosial', 'Etika Psikologi'],
  agriculture: ['Ilmu Tanah', 'Ekologi Pertanian', 'Budidaya Tanaman', 'Sistem Pangan'],
  politics: ['Ilmu Politik', 'Kebijakan Publik', 'Hubungan Internasional', 'Metode Sosial'],
  communication: ['Teori Komunikasi', 'Jurnalistik Dasar', 'Media dan Masyarakat', 'Produksi Konten'],
  arts: ['Apresiasi Seni', 'Studio Kreatif', 'Sejarah Seni', 'Praktik Karya'],
  science: ['Metode Ilmiah', 'Statistika', 'Laboratorium Dasar', 'Penulisan Sains'],
  research: ['Metodologi Lanjut', 'Analisis Data', 'Seminar Riset', 'Etika Penelitian'],
};

function createCourses(programId: string, durationSemesters: number, subjects: string[]) {
  return Array.from({ length: durationSemesters }, (_, index) => {
    const semester = index + 1;
    return subjects.map((name, subjectIndex) => ({
      id: `${programId}-s${semester}-c${subjectIndex + 1}`,
      code: `${programId.slice(0, 3).toUpperCase()}-${semester}${subjectIndex + 1}`,
      name: `${name} ${semester > 1 ? `II · ${semester}` : 'I'}`,
      semester,
      credits: subjectIndex === 3 ? 2 : 3,
      kind: (subjectIndex === 3 ? 'practicum' : 'lecture') as 'lecture' | 'practicum',
    }));
  }).flat();
}

function program(
  id: string,
  name: string,
  facultyId: string,
  level: EducationLevel,
  durationSemesters: number,
  entryLevels: EducationLevel[],
  tuitionPerSemester: number,
  degreeTitle: string,
  degreeAbbreviation: string,
  subjectKey: string,
  minimumGpa?: number,
): StudyProgram {
  return {
    id,
    name,
    facultyId,
    level,
    durationSemesters,
    entryLevels,
    minimumGpa,
    tuitionPerSemester,
    degreeTitle,
    degreeAbbreviation,
    courses: createCourses(id, durationSemesters, courseNames[subjectKey]),
    countryCode: 'ID',
  };
}

export const studyPrograms: StudyProgram[] = [
  program('d1-akuntansi', 'Akuntansi Terapan', 'economics', 'd1', 2, ['sma', 'smk'], 2_000_000, 'Ahli Pratama Akuntansi', 'A.P.Ak.', 'accounting'),
  program('d2-manajemen', 'Manajemen Usaha', 'economics', 'd2', 4, ['sma', 'smk'], 2_500_000, 'Ahli Muda Manajemen', 'A.M.M.', 'business'),
  program('d3-akuntansi', 'Akuntansi', 'economics', 'd3', 6, ['sma', 'smk'], 3_000_000, 'Ahli Madya Akuntansi', 'A.Md.Ak.', 'accounting'),
  program('d4-rekayasa', 'Rekayasa Terapan', 'engineering', 'd4', 8, ['sma', 'smk'], 4_000_000, 'Sarjana Terapan Teknik', 'S.Tr.T.', 'engineering'),
  program('s1-kedokteran', 'Kedokteran', 'health', 's1', 12, ['sma', 'smk'], 18_000_000, 'Sarjana Kedokteran', 'S.Ked.', 'medicine', 3),
  program('s1-hukum', 'Ilmu Hukum', 'law', 's1', 8, ['sma', 'smk'], 6_000_000, 'Sarjana Hukum', 'S.H.', 'law'),
  program('s1-ekonomi', 'Ekonomi', 'economics', 's1', 8, ['sma', 'smk'], 5_000_000, 'Sarjana Ekonomi', 'S.E.', 'accounting'),
  program('s1-akuntansi', 'Akuntansi', 'economics', 's1', 8, ['sma', 'smk'], 5_500_000, 'Sarjana Akuntansi', 'S.Ak.', 'accounting'),
  program('s1-teknik', 'Teknik', 'engineering', 's1', 8, ['sma', 'smk'], 7_000_000, 'Sarjana Teknik', 'S.T.', 'engineering'),
  program('s1-informatika', 'Informatika', 'engineering', 's1', 8, ['sma', 'smk'], 7_000_000, 'Sarjana Komputer', 'S.Kom.', 'informatics'),
  program('s1-pendidikan', 'Pendidikan', 'education', 's1', 8, ['sma', 'smk'], 4_500_000, 'Sarjana Pendidikan', 'S.Pd.', 'education'),
  program('s1-psikologi', 'Psikologi', 'social_sciences', 's1', 8, ['sma', 'smk'], 5_500_000, 'Sarjana Psikologi', 'S.Psi.', 'psychology'),
  program('s1-pertanian', 'Pertanian', 'agriculture', 's1', 8, ['sma', 'smk'], 4_000_000, 'Sarjana Pertanian', 'S.P.', 'agriculture'),
  program('s1-ilmu-politik', 'Ilmu Politik', 'social_sciences', 's1', 8, ['sma', 'smk'], 5_000_000, 'Sarjana Ilmu Politik', 'S.IP.', 'politics'),
  program('s1-komunikasi', 'Ilmu Komunikasi', 'social_sciences', 's1', 8, ['sma', 'smk'], 5_000_000, 'Sarjana Ilmu Komunikasi', 'S.I.Kom.', 'communication'),
  program('s1-seni', 'Seni dan Desain', 'arts', 's1', 8, ['sma', 'smk'], 6_000_000, 'Sarjana Seni', 'S.Sn.', 'arts'),
  program('s1-sains', 'Sains', 'science', 's1', 8, ['sma', 'smk'], 6_000_000, 'Sarjana Sains', 'S.Si.', 'science'),
  program('s2-manajemen', 'Manajemen', 'economics', 's2', 4, ['s1', 'd4'], 10_000_000, 'Magister Manajemen', 'M.M.', 'business', 2.75),
  program('s2-sains', 'Sains Terapan', 'science', 's2', 4, ['s1', 'd4'], 11_000_000, 'Master of Science', 'M.Sc.', 'research', 2.75),
  program('s2-pendidikan', 'Pendidikan', 'education', 's2', 4, ['s1', 'd4'], 8_000_000, 'Magister Pendidikan', 'M.Pd.', 'education', 2.75),
  program('s3-penelitian', 'Penelitian Interdisipliner', 'science', 's3', 6, ['s2'], 14_000_000, 'Doktor', 'Dr.', 'research', 3),
];

export const universities: University[] = [
  {
    id: 'universitas-nusantara-maju',
    name: 'Universitas Nusantara Maju',
    countryCode: 'ID',
    city: 'Padang',
    reputation: 78,
    accreditation: 'Akreditasi simulasi: Unggul',
    facilities: ['Perpustakaan', 'Laboratorium', 'Pusat beasiswa', 'Klinik kampus'],
    fictional: true,
    faculties: [
      { id: 'economics', universityId: 'universitas-nusantara-maju', name: 'Fakultas Ekonomi', programIds: ['d1-akuntansi', 'd2-manajemen', 'd3-akuntansi', 's1-ekonomi', 's1-akuntansi', 's2-manajemen'] },
      { id: 'law', universityId: 'universitas-nusantara-maju', name: 'Fakultas Hukum', programIds: ['s1-hukum'] },
      { id: 'health', universityId: 'universitas-nusantara-maju', name: 'Fakultas Kesehatan', programIds: ['s1-kedokteran'] },
      { id: 'education', universityId: 'universitas-nusantara-maju', name: 'Fakultas Pendidikan', programIds: ['s1-pendidikan', 's2-pendidikan'] },
      { id: 'social_sciences', universityId: 'universitas-nusantara-maju', name: 'Fakultas Ilmu Sosial', programIds: ['s1-psikologi', 's1-ilmu-politik', 's1-komunikasi'] },
      { id: 'agriculture', universityId: 'universitas-nusantara-maju', name: 'Fakultas Pertanian', programIds: ['s1-pertanian'] },
      { id: 'arts', universityId: 'universitas-nusantara-maju', name: 'Fakultas Seni', programIds: ['s1-seni'] },
      { id: 'science', universityId: 'universitas-nusantara-maju', name: 'Fakultas Sains', programIds: ['s1-sains', 's2-sains', 's3-penelitian'] },
    ],
  },
  {
    id: 'institut-teknologi-pusaka',
    name: 'Institut Teknologi Pusaka',
    countryCode: 'ID',
    city: 'Bandung',
    reputation: 82,
    accreditation: 'Akreditasi simulasi: Baik Sekali',
    facilities: ['Studio desain', 'Laboratorium rekayasa', 'Inkubator riset'],
    fictional: true,
    faculties: [
      { id: 'engineering', universityId: 'institut-teknologi-pusaka', name: 'Fakultas Rekayasa', programIds: ['d4-rekayasa', 's1-teknik', 's1-informatika'] },
      { id: 'science', universityId: 'institut-teknologi-pusaka', name: 'Fakultas Sains dan Riset', programIds: ['s1-sains', 's2-sains', 's3-penelitian'] },
      { id: 'arts', universityId: 'institut-teknologi-pusaka', name: 'Fakultas Seni dan Desain', programIds: ['s1-seni'] },
    ],
  },
];

export const scholarships: ScholarshipDefinition[] = [
  { id: 'prestasi-penuh', name: 'Beasiswa Prestasi Penuh', type: 'full', countryCode: 'ID', eligibleLevels: ['d1', 'd2', 'd3', 'd4', 's1', 's2', 's3'], minimumGpa: 3.5, minimumReputation: 30, tuitionCoveragePercent: 100, stipendPerSemester: 1_000_000, durationSemesters: 8 },
  { id: 'bantuan-ekonomi', name: 'Bantuan Pendidikan Ekonomi', type: 'economic_aid', countryCode: 'ID', eligibleLevels: ['d1', 'd2', 'd3', 'd4', 's1'], minimumGpa: 2, minimumReputation: 0, tuitionCoveragePercent: 70, stipendPerSemester: 500_000, durationSemesters: 8 },
  { id: 'beasiswa-pemerintah', name: 'Beasiswa Pemerintah Simulasi', type: 'government', countryCode: 'ID', eligibleLevels: ['s1', 's2', 's3'], minimumGpa: 3.25, minimumReputation: 20, tuitionCoveragePercent: 100, stipendPerSemester: 1_500_000, durationSemesters: 8 },
  { id: 'beasiswa-universitas', name: 'Beasiswa Universitas', type: 'university', countryCode: 'ID', eligibleLevels: ['d1', 'd2', 'd3', 'd4', 's1', 's2'], minimumGpa: 3, minimumReputation: 10, tuitionCoveragePercent: 50, stipendPerSemester: 0, durationSemesters: 6 },
  { id: 'beasiswa-merit', name: 'Beasiswa Merit Akademik', type: 'merit', countryCode: 'ID', eligibleLevels: ['d1', 'd2', 'd3', 'd4', 's1', 's2', 's3'], minimumGpa: 3.5, minimumReputation: 25, tuitionCoveragePercent: 75, stipendPerSemester: 750_000, durationSemesters: 6 },
  { id: 'beasiswa-riset', name: 'Beasiswa Penelitian', type: 'research', countryCode: 'ID', eligibleLevels: ['s2', 's3'], minimumGpa: 3, minimumReputation: 30, tuitionCoveragePercent: 80, stipendPerSemester: 2_000_000, durationSemesters: 6 },
  { id: 'beasiswa-internasional', name: 'Beasiswa Internasional Simulasi', type: 'international', countryCode: 'ID', eligibleLevels: ['s1', 's2', 's3'], minimumGpa: 3.6, minimumReputation: 50, tuitionCoveragePercent: 100, stipendPerSemester: 2_500_000, durationSemesters: 6 },
  { id: 'beasiswa-parsial', name: 'Beasiswa Parsial', type: 'partial', countryCode: 'ID', eligibleLevels: ['d1', 'd2', 'd3', 'd4', 's1', 's2'], minimumGpa: 2.75, minimumReputation: 0, tuitionCoveragePercent: 30, stipendPerSemester: 0, durationSemesters: 4 },
];

export function getEducationLevelLabel(level: EducationLevel): string {
  const labels: Record<EducationLevel, string> = {
    none: 'Belum sekolah',
    paud: 'PAUD',
    tk: 'Taman Kanak-kanak',
    sd: 'Sekolah Dasar',
    smp: 'Sekolah Menengah Pertama',
    sma: 'Sekolah Menengah Atas',
    smk: 'Sekolah Menengah Kejuruan',
    d1: 'Diploma 1',
    d2: 'Diploma 2',
    d3: 'Diploma 3',
    d4: 'Diploma 4',
    s1: 'Sarjana',
    s2: 'Magister',
    s3: 'Doktor',
  };
  return educationLevelConfigurations.find((item) => item.level === level)?.label ?? labels[level];
}
