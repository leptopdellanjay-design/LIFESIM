import type { CareerCategory, Employer, Occupation } from '../types/game';

const fictionalEmployers = {
  public: ['Layanan Nusantara', 'Biro Cakrawala'],
  state: ['Perusahaan Mandiri Nusantara', 'Energi Pusaka'],
  private: ['Karya Bersama', 'Ruang Tumbuh Group'],
  health: ['Klinik Sehat Bersama', 'Rumah Sehat Nusantara'],
  education: ['Sekolah Tunas Bangsa', 'Institut Cakrawala'],
  technology: ['Teknologi Pusaka', 'Inovasi Digital Nusantara'],
  creative: ['Studio Layar Kecil', 'Kreasi Lokal'],
  community: ['Koperasi Harapan', 'Komunitas Pesisir'],
};

function track(
  id: string,
  category: CareerCategory,
  name: string,
  minimumAge: number,
  requiredLevels: Occupation['requiredLevels'],
  minimumExperienceYears: number,
  minimumReputation: number,
  monthlySalary: number,
  workHoursPerWeek: number,
  promotionAfterYears: number,
  titles: string[],
  employerGroup: keyof typeof fictionalEmployers,
  risk: Occupation['risk'] = 'moderate',
  requiredProgramIds?: string[],
): Occupation {
  return {
    id,
    category,
    name,
    countryCode: 'ID',
    minimumAge,
    requiredLevels,
    minimumExperienceYears,
    minimumReputation,
    monthlySalary,
    workHoursPerWeek,
    promotionAfterYears,
    titles,
    fictionalEmployerNames: fictionalEmployers[employerGroup],
    risk,
    ...(requiredProgramIds ? { requiredProgramIds } : {}),
  };
}

export const occupations: Occupation[] = [
  track('entry-worker', 'private', 'Karyawan pemula', 18, ['sma', 'smk'], 0, 0, 4_500_000, 40, 2, ['Staf Junior', 'Staf', 'Supervisor', 'Manajer', 'Direktur'], 'private'),
  track('civil-servant', 'government', 'PNS / ASN', 18, ['sma', 'smk', 'd3', 's1'], 0, 10, 5_000_000, 40, 3, ['Staf', 'Analis', 'Supervisor', 'Kepala Bagian', 'Pejabat Senior'], 'public', 'low'),
  track('diplomat', 'government', 'Diplomat', 21, ['s1', 's2'], 0, 30, 9_000_000, 45, 4, ['Diplomat Muda', 'Diplomat', 'Konselor', 'Duta Besar'], 'public', 'moderate'),
  track('state-enterprise', 'state_enterprise', 'Staf BUMN', 18, ['sma', 'smk', 'd3', 's1'], 0, 10, 6_000_000, 40, 3, ['Staf', 'Supervisor', 'Manajer', 'Direktur'], 'state'),
  track('nurse', 'health', 'Perawat', 20, ['d3', 'd4', 's1'], 0, 10, 6_500_000, 40, 3, ['Perawat', 'Perawat Senior', 'Koordinator', 'Kepala Unit'], 'health', 'moderate'),
  track('doctor', 'health', 'Dokter', 23, ['s1'], 2, 25, 14_000_000, 45, 4, ['Dokter Umum', 'Dokter Senior', 'Kepala Layanan', 'Direktur Medis'], 'health', 'high', ['s1-kedokteran']),
  track('pharmacist', 'health', 'Apoteker', 22, ['s1'], 1, 15, 8_000_000, 40, 3, ['Apoteker', 'Apoteker Senior', 'Kepala Farmasi'], 'health'),
  track('teacher', 'education', 'Guru', 21, ['s1'], 0, 10, 5_500_000, 40, 4, ['Guru', 'Guru Senior', 'Wakil Kepala Sekolah', 'Kepala Sekolah'], 'education'),
  track('lecturer', 'education', 'Dosen', 24, ['s2'], 0, 25, 8_500_000, 40, 4, ['Dosen', 'Lektor', 'Lektor Kepala', 'Profesor'], 'education'),
  track('researcher', 'education', 'Peneliti', 25, ['s2'], 0, 25, 9_000_000, 40, 4, ['Asisten Peneliti', 'Peneliti', 'Peneliti Senior', 'Kepala Riset'], 'education', 'moderate', ['s3-penelitian']),
  track('programmer', 'technology', 'Programmer', 18, ['sma', 'smk', 'd3', 's1'], 0, 0, 7_000_000, 40, 2, ['Junior Programmer', 'Programmer', 'Senior Engineer', 'Tech Lead', 'Engineering Manager'], 'technology'),
  track('software-engineer', 'technology', 'Software Engineer', 20, ['d4', 's1'], 0, 10, 10_000_000, 40, 3, ['Junior Engineer', 'Engineer', 'Senior Engineer', 'Tech Lead', 'Director'], 'technology'),
  track('data-analyst', 'technology', 'Data Analyst', 20, ['d4', 's1'], 0, 10, 8_500_000, 40, 3, ['Analis Junior', 'Analis', 'Analis Senior', 'Manajer Data'], 'technology'),
  track('ai-researcher', 'technology', 'Peneliti AI', 23, ['s2'], 0, 25, 14_000_000, 40, 4, ['Asisten Riset', 'Peneliti', 'Peneliti Senior', 'Kepala Riset'], 'technology', 'moderate'),
  track('cybersecurity-professional', 'technology', 'Spesialis Keamanan Informasi', 20, ['d3', 'd4', 's1'], 0, 10, 10_000_000, 40, 3, ['Analis Junior', 'Analis', 'Spesialis Senior', 'Kepala Tim'], 'technology', 'moderate'),
  track('entrepreneur', 'business', 'Pengusaha', 21, ['sma', 'smk'], 0, 10, 6_000_000, 45, 5, ['Pemilik Usaha', 'Pemimpin Usaha', 'Pemilik Perusahaan'], 'private', 'high'),
  track('lawyer', 'law', 'Pengacara', 23, ['s1'], 2, 25, 9_000_000, 45, 4, ['Asisten Hukum', 'Pengacara', 'Mitra', 'Kepala Praktik'], 'private', 'moderate'),
  track('police', 'security', 'Polisi', 18, ['sma', 'smk'], 0, 10, 5_500_000, 45, 4, ['Anggota', 'Petugas Senior', 'Pengawas', 'Komandan Unit'], 'public', 'high'),
  track('artist', 'creative', 'Seniman', 16, [], 0, 0, 3_000_000, 35, 4, ['Seniman', 'Seniman Senior', 'Direktur Kreatif'], 'creative'),
  track('journalist', 'media', 'Jurnalis', 18, ['sma', 'smk', 'd3', 's1'], 0, 5, 5_500_000, 42, 3, ['Reporter Junior', 'Reporter', 'Editor', 'Pemimpin Redaksi'], 'creative', 'moderate'),
  track('farmer', 'agriculture', 'Petani', 18, [], 0, 0, 3_500_000, 40, 5, ['Petani', 'Pengelola Lahan', 'Pengusaha Tani'], 'community', 'high'),
  track('fisher', 'transport', 'Nelayan', 18, [], 0, 0, 3_700_000, 40, 5, ['Nelayan', 'Ketua Kelompok', 'Pengelola Usaha Pesisir'], 'community', 'high'),
  track('athlete', 'sports', 'Atlet', 16, [], 0, 0, 4_000_000, 35, 4, ['Atlet', 'Atlet Senior', 'Pelatih'], 'community', 'high'),
  track('freelancer', 'freelance', 'Pekerja Lepas', 18, [], 0, 0, 4_000_000, 35, 3, ['Pekerja Lepas', 'Konsultan', 'Pemilik Studio'], 'creative'),
  track('community-activist', 'politics', 'Aktivis Masyarakat', 18, [], 0, 20, 4_000_000, 35, 4, ['Relawan', 'Koordinator', 'Pemimpin Gerakan'], 'community'),
];

export const employers: Employer[] = occupations.flatMap((occupation) => (
  occupation.fictionalEmployerNames.map((name, index) => ({
    id: `${occupation.id}-employer-${index}`,
    name,
    countryCode: occupation.countryCode,
    category: occupation.category,
    fictional: true,
  }))
));

export const careerCategoryLabels: Record<CareerCategory, string> = {
  government: 'Pemerintah',
  state_enterprise: 'BUMN',
  private: 'Swasta',
  health: 'Kesehatan',
  education: 'Pendidikan',
  technology: 'Teknologi',
  business: 'Bisnis',
  law: 'Hukum',
  security: 'Keamanan',
  creative: 'Kreatif',
  politics: 'Politik',
  agriculture: 'Pertanian',
  transport: 'Transportasi',
  sports: 'Olahraga',
  media: 'Media',
  freelance: 'Pekerja lepas',
};

export function getOccupation(id: string | null) {
  return id ? occupations.find((occupation) => occupation.id === id) ?? null : null;
}

export function getOccupationTitle(occupationId: string | null, positionIndex = 0): string {
  const occupation = getOccupation(occupationId);
  if (!occupation) return 'Belum bekerja';
  return occupation.titles[Math.min(positionIndex, occupation.titles.length - 1)];
}

export function getEmployer(employerId: string | null): Employer | null {
  return employerId ? employers.find((employer) => employer.id === employerId) ?? null : null;
}
