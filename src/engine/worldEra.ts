import type { PersonalityTrait, PersonalityTraits } from '../types/game';

export interface WorldYearContext {
  year: number;
  decadeLabel: string;
  smartphoneAvailable: boolean;
  technologySummary: string;
}

export function getWorldYearContext(year: number): WorldYearContext {
  const decade = Math.floor(year / 10) * 10;
  const smartphoneAvailable = year >= 2007;

  if (year > 2026) {
    return {
      year,
      decadeLabel: `Masa depan · ${decade}-an`,
      smartphoneAvailable,
      technologySummary: 'Gambaran teknologi masa depan adalah fiksi simulasi, bukan prediksi faktual.',
    };
  }

  if (year < 1950) {
    return {
      year,
      decadeLabel: `Era ${decade}-an`,
      smartphoneAvailable,
      technologySummary: 'Informasi dan komunikasi mengandalkan surat serta media cetak.',
    };
  }
  if (year < 1960) {
    return {
      year,
      decadeLabel: 'Era 1950-an',
      smartphoneAvailable,
      technologySummary: 'Komunikasi mengandalkan surat, radio, dan telepon yang terbatas.',
    };
  }
  if (year < 1990) {
    return {
      year,
      decadeLabel: `${decade}-an`,
      smartphoneAvailable,
      technologySummary: 'Radio, televisi, dan telepon kabel menjadi bagian dari teknologi era ini.',
    };
  }
  if (year < 2000) {
    return {
      year,
      decadeLabel: 'Era 1990-an',
      smartphoneAvailable,
      technologySummary: 'Komputer pribadi dan telepon seluler mulai dikenal; smartphone belum tersedia.',
    };
  }
  if (year < 2010) {
    return {
      year,
      decadeLabel: `${decade}-an`,
      smartphoneAvailable,
      technologySummary: smartphoneAvailable
        ? 'Ponsel pintar mulai tersedia menjelang akhir dekade.'
        : 'Internet dan ponsel generasi awal mulai berkembang; smartphone belum tersedia.',
    };
  }
  return {
    year,
    decadeLabel: `${decade}-an`,
    smartphoneAvailable,
    technologySummary: 'Internet seluler dan ponsel pintar tersedia dalam simulasi.',
  };
}

export function getNominalPriceFactor(year: number): number {
  return Math.pow(1.045, year - 2026);
}

const eventAffinity: Partial<Record<PersonalityTrait, Record<string, number>>> = {
  brave: { adventure: 0.16, challenge: 0.12 },
  shy: { social: -0.1, relationship: -0.05 },
  intelligent: { education: 0.13, challenge: 0.08 },
  ambitious: { career: 0.16, education: 0.08 },
  friendly: { social: 0.13, relationship: 0.14 },
  short_tempered: { conflict: 0.13 },
  disciplined: { education: 0.1, career: 0.1 },
  lazy: { career: -0.1, challenge: -0.06 },
  creative: { culture: 0.14, challenge: 0.05 },
  lucky: { chance: 0.08 },
};

export function adjustEventWeightForPersonality(
  baseWeight: number,
  category: string,
  personality: PersonalityTraits,
): number {
  if (!Number.isFinite(baseWeight) || baseWeight <= 0) return 0;
  const affinity = personality.traits.reduce(
    (total, trait) => total + (eventAffinity[trait]?.[category] ?? 0),
    0,
  );
  const modifier = Math.max(0.5, Math.min(1.5, 1 + affinity));
  return baseWeight * modifier;
}
