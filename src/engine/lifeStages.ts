import type { LifeStage } from '../types/game';

export interface LifeStageDefinition {
  id: LifeStage;
  label: string;
  minAge: number;
  maxAge: number;
}

export const lifeStages: LifeStageDefinition[] = [
  { id: 'baby', label: 'Bayi', minAge: 0, maxAge: 2 },
  { id: 'toddler', label: 'Balita', minAge: 3, maxAge: 5 },
  { id: 'child', label: 'Anak-anak', minAge: 6, maxAge: 12 },
  { id: 'teenager', label: 'Remaja', minAge: 13, maxAge: 17 },
  { id: 'young_adult', label: 'Dewasa muda', minAge: 18, maxAge: 25 },
  { id: 'adult', label: 'Dewasa', minAge: 26, maxAge: 40 },
  { id: 'middle_age', label: 'Paruh baya', minAge: 41, maxAge: 59 },
  { id: 'senior', label: 'Lansia', minAge: 60, maxAge: 74 },
  { id: 'elderly', label: 'Usia lanjut', minAge: 75, maxAge: Number.MAX_SAFE_INTEGER },
];

export function getLifeStage(age: number): LifeStageDefinition {
  const safeAge = Number.isFinite(age) ? Math.max(0, Math.floor(age)) : 0;
  return lifeStages.find((stage) => safeAge <= stage.maxAge) ?? lifeStages[lifeStages.length - 1];
}
