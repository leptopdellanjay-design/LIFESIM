import type { FamilyBackgroundTier, HousingCondition, OpportunityLevel } from '../types/game';

export interface FamilyBackgroundDefinition {
  id: FamilyBackgroundTier;
  label: string;
  description: string;
  housingLabel: string;
  opportunityLabel: string;
  cashBase: number;
  nonCashBase: number;
  parentSalaryRange: [number, number];
  monthlySupportRate: number;
  housingCondition: HousingCondition;
  facilities: string[];
  opportunityLevel: OpportunityLevel;
}

export const familyBackgrounds: FamilyBackgroundDefinition[] = [
  {
    id: 'very_poor',
    label: 'Sangat miskin',
    description: 'Kebutuhan keluarga sering kali sulit terpenuhi.',
    housingLabel: 'Tempat tinggal sementara',
    opportunityLabel: 'Terbatas',
    cashBase: 60_000,
    nonCashBase: 0,
    parentSalaryRange: [0, 4_000_000],
    monthlySupportRate: 0.025,
    housingCondition: 'temporary',
    facilities: ['Kebutuhan dasar terbatas'],
    opportunityLevel: 'limited',
  },
  {
    id: 'poor',
    label: 'Miskin',
    description: 'Keluarga berhemat untuk mencukupi kebutuhan utama.',
    housingLabel: 'Rumah dasar',
    opportunityLabel: 'Terbatas',
    cashBase: 150_000,
    nonCashBase: 20_000_000,
    parentSalaryRange: [3_000_000, 5_500_000],
    monthlySupportRate: 0.04,
    housingCondition: 'basic',
    facilities: ['Fasilitas rumah dasar'],
    opportunityLevel: 'limited',
  },
  {
    id: 'modest',
    label: 'Sederhana',
    description: 'Kebutuhan sehari-hari umumnya tercukupi.',
    housingLabel: 'Rumah sederhana',
    opportunityLabel: 'Dasar',
    cashBase: 400_000,
    nonCashBase: 90_000_000,
    parentSalaryRange: [3_500_000, 7_000_000],
    monthlySupportRate: 0.055,
    housingCondition: 'modest',
    facilities: ['Listrik', 'Air bersih'],
    opportunityLevel: 'basic',
  },
  {
    id: 'middle',
    label: 'Menengah',
    description: 'Keluarga memiliki ruang untuk menabung dan mengembangkan diri.',
    housingLabel: 'Rumah nyaman',
    opportunityLabel: 'Berkembang',
    cashBase: 1_200_000,
    nonCashBase: 300_000_000,
    parentSalaryRange: [4_500_000, 8_500_000],
    monthlySupportRate: 0.075,
    housingCondition: 'comfortable',
    facilities: ['Listrik', 'Air bersih', 'Akses pendidikan'],
    opportunityLevel: 'growing',
  },
  {
    id: 'affluent',
    label: 'Berada',
    description: 'Keluarga memiliki aset dan akses ke lebih banyak pilihan.',
    housingLabel: 'Rumah luas',
    opportunityLabel: 'Luas',
    cashBase: 3_000_000,
    nonCashBase: 1_000_000_000,
    parentSalaryRange: [6_000_000, 14_000_000],
    monthlySupportRate: 0.095,
    housingCondition: 'large',
    facilities: ['Listrik', 'Air bersih', 'Akses pendidikan', 'Kendaraan keluarga'],
    opportunityLevel: 'broad',
  },
  {
    id: 'wealthy',
    label: 'Kaya',
    description: 'Keluarga memiliki sumber daya dan fasilitas yang luas.',
    housingLabel: 'Rumah luas',
    opportunityLabel: 'Luas',
    cashBase: 8_000_000,
    nonCashBase: 3_000_000_000,
    parentSalaryRange: [8_000_000, 14_000_000],
    monthlySupportRate: 0.12,
    housingCondition: 'large',
    facilities: ['Listrik', 'Air bersih', 'Akses pendidikan', 'Kendaraan keluarga', 'Ruang belajar'],
    opportunityLevel: 'broad',
  },
];

export function getFamilyBackground(tier: FamilyBackgroundTier): FamilyBackgroundDefinition {
  const background = familyBackgrounds.find((item) => item.id === tier);
  if (!background) throw new Error(`Latar keluarga tidak dikenal: ${tier}`);
  return background;
}
