import type {
  DigitalAppId,
  DigitalContentCategory,
  DigitalPlatformId,
} from '../types/game';

export interface SmartphoneModel {
  id: string;
  name: string;
  tier: 'feature' | 'entry' | 'mid' | 'premium' | 'flagship';
  releaseYear: number;
  price: number;
  creatorQuality: number;
}

export const smartphoneModels: SmartphoneModel[] = [
  { id: 'layar-saku', name: 'Layar Saku', tier: 'feature', releaseYear: 2007, price: 900_000, creatorQuality: 12 },
  { id: 'rintis-one', name: 'Rintis One', tier: 'entry', releaseYear: 2010, price: 1_800_000, creatorQuality: 25 },
  { id: 'cakrawala-m', name: 'Cakrawala M', tier: 'mid', releaseYear: 2015, price: 4_000_000, creatorQuality: 45 },
  { id: 'nusa-pro', name: 'Nusa Pro', tier: 'premium', releaseYear: 2018, price: 8_500_000, creatorQuality: 65 },
  { id: 'rimba-creator', name: 'Rimba Creator', tier: 'premium', releaseYear: 2022, price: 14_000_000, creatorQuality: 84 },
  { id: 'garuda-ultra', name: 'Garuda Ultra', tier: 'flagship', releaseYear: 2026, price: 22_000_000, creatorQuality: 100 },
];

export interface DataPackageDefinition {
  id: string;
  name: string;
  dataMb: number;
  durationMonths: number;
  price: number;
}

export const dataPackages: DataPackageDefinition[] = [
  { id: 'paket-1gb', name: 'Paket Hemat 1 GB', dataMb: 1_024, durationMonths: 1, price: 35_000 },
  { id: 'paket-5gb', name: 'Paket Aktif 5 GB', dataMb: 5_120, durationMonths: 1, price: 75_000 },
  { id: 'paket-20gb', name: 'Paket Kreator 20 GB', dataMb: 20_480, durationMonths: 1, price: 150_000 },
];

export interface CreatorEquipmentDefinition {
  id: string;
  name: string;
  releaseYear: number;
  price: number;
  quality: number;
}

export const creatorEquipment: CreatorEquipmentDefinition[] = [
  { id: 'creator-mic', name: 'Mikrofon Suara Jernih', releaseYear: 2007, price: 750_000, quality: 8 },
  { id: 'creator-light', name: 'Lampu Studio Ringkas', releaseYear: 2010, price: 1_200_000, quality: 12 },
  { id: 'creator-camera', name: 'Kamera Lensa Nusantara', releaseYear: 2012, price: 5_000_000, quality: 22 },
];

export interface DigitalPlatformDefinition {
  id: DigitalPlatformId;
  name: string;
  releaseYear: number;
  audienceLabel: 'pengikut' | 'subscriber';
  monetizationAudienceThreshold: number;
  monetizationViewThreshold: number;
  revenuePerThousandViews: number;
  followerConversionRate: number;
  uploadDataMb: number;
}

export const digitalPlatforms: DigitalPlatformDefinition[] = [
  {
    id: 'indotube',
    name: 'IndoTube',
    releaseYear: 2005,
    audienceLabel: 'subscriber',
    monetizationAudienceThreshold: 1_000,
    monetizationViewThreshold: 50_000,
    revenuePerThousandViews: 18_000,
    followerConversionRate: 0.035,
    uploadDataMb: 500,
  },
  {
    id: 'faceworld',
    name: 'FaceWorld',
    releaseYear: 2004,
    audienceLabel: 'pengikut',
    monetizationAudienceThreshold: 2_000,
    monetizationViewThreshold: 30_000,
    revenuePerThousandViews: 8_000,
    followerConversionRate: 0.018,
    uploadDataMb: 120,
  },
  {
    id: 'instalife',
    name: 'InstaLife',
    releaseYear: 2010,
    audienceLabel: 'pengikut',
    monetizationAudienceThreshold: 3_000,
    monetizationViewThreshold: 40_000,
    revenuePerThousandViews: 11_000,
    followerConversionRate: 0.022,
    uploadDataMb: 180,
  },
  {
    id: 'tiklife',
    name: 'TikLife',
    releaseYear: 2016,
    audienceLabel: 'pengikut',
    monetizationAudienceThreshold: 5_000,
    monetizationViewThreshold: 100_000,
    revenuePerThousandViews: 14_000,
    followerConversionRate: 0.04,
    uploadDataMb: 300,
  },
];

export interface DigitalAppDefinition {
  id: DigitalAppId;
  name: string;
  description: string;
  releaseYear: number;
}

export const digitalApps: DigitalAppDefinition[] = [
  { id: 'social', name: 'Jaringan', description: 'Buat profil dan kelola akun sosial.', releaseYear: 2007 },
  { id: 'creator', name: 'Kamera & Studio', description: 'Rekam, unggah, dan pantau konten.', releaseYear: 2007 },
  { id: 'market', name: 'Pasar Digital', description: 'Beli perangkat dan peralatan kreator.', releaseYear: 2007 },
  { id: 'wallet', name: 'Dompet', description: 'Lihat saldo bersama dan beli paket data.', releaseYear: 2007 },
];

export const digitalContentCategories: Array<{ id: DigitalContentCategory; label: string }> = [
  { id: 'gaming', label: 'Gaming' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'education', label: 'Edukasi' },
  { id: 'comedy', label: 'Komedi' },
  { id: 'music', label: 'Musik' },
  { id: 'culinary', label: 'Kuliner' },
  { id: 'travel', label: 'Perjalanan' },
  { id: 'technology', label: 'Teknologi' },
  { id: 'beauty', label: 'Kecantikan' },
  { id: 'sports', label: 'Olahraga' },
  { id: 'business', label: 'Bisnis' },
  { id: 'daily_life', label: 'Kehidupan sehari-hari' },
];

export interface CreatorTitleDefinition {
  id: string;
  label: string;
  minimumAudience: number;
  minimumViews: number;
  minimumIncome: number;
  minimumContent: number;
  minimumEngagement: number;
}

export const creatorTitleCatalog: CreatorTitleDefinition[] = [
  { id: 'creator-starter', label: 'Kreator Pemula', minimumAudience: 0, minimumViews: 0, minimumIncome: 0, minimumContent: 1, minimumEngagement: 0 },
  { id: 'creator-rising', label: 'Kreator Berkembang', minimumAudience: 1_000, minimumViews: 10_000, minimumIncome: 0, minimumContent: 5, minimumEngagement: 0.01 },
  { id: 'creator-famous', label: 'Kreator Terkenal', minimumAudience: 10_000, minimumViews: 250_000, minimumIncome: 0, minimumContent: 15, minimumEngagement: 0.02 },
  { id: 'digital-influencer', label: 'Influencer', minimumAudience: 50_000, minimumViews: 1_500_000, minimumIncome: 1_000_000, minimumContent: 30, minimumEngagement: 0.025 },
  { id: 'digital-celebrity', label: 'Selebritas Digital', minimumAudience: 250_000, minimumViews: 5_000_000, minimumIncome: 10_000_000, minimumContent: 50, minimumEngagement: 0.03 },
  { id: 'digital-icon', label: 'Ikon Digital', minimumAudience: 1_000_000, minimumViews: 20_000_000, minimumIncome: 100_000_000, minimumContent: 100, minimumEngagement: 0.04 },
];

export interface DigitalBankDefinition {
  id: string;
  name: string;
  foundedYear: number;
  openingFee: number;
  annualInterestRate: number;
  transferFee: number;
}

export const digitalBanks: DigitalBankDefinition[] = [
  { id: 'bank-nusantara', name: 'Bank Nusantara', foundedYear: 1998, openingFee: 25_000, annualInterestRate: 0.025, transferFee: 2_500 },
  { id: 'bank-merdeka', name: 'Bank Merdeka', foundedYear: 2005, openingFee: 10_000, annualInterestRate: 0.03, transferFee: 1_500 },
  { id: 'bank-digital', name: 'Bank Digital', foundedYear: 2016, openingFee: 0, annualInterestRate: 0.04, transferFee: 1_000 },
];

export const socialAccountEligibilityAge = 13;

export function getSmartphoneModel(modelId: string): SmartphoneModel | null {
  return smartphoneModels.find((model) => model.id === modelId) ?? null;
}

export function getDigitalPlatform(platformId: DigitalPlatformId): DigitalPlatformDefinition {
  const platform = digitalPlatforms.find((item) => item.id === platformId);
  if (!platform) throw new Error(`Platform digital tidak dikenal: ${platformId}`);
  return platform;
}
