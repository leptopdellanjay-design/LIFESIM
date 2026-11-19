import { getFamilyBackground } from '../data/familyBackgrounds';
import { getOccupation, occupations } from '../data/careerCatalog';
import type {
  Character,
  FamilyBackgroundTier,
} from '../types/game';
import { getNominalPriceFactor } from './worldEra';

export function randomParentOccupationId(
  backgroundTier: FamilyBackgroundTier,
  random: () => number = Math.random,
): string {
  const { parentSalaryRange } = getFamilyBackground(backgroundTier);
  const candidates = occupations.filter((occupation) => (
    occupation.monthlySalary >= parentSalaryRange[0]
    && occupation.monthlySalary <= parentSalaryRange[1]
  ));
  if (candidates.length === 0) {
    throw new Error(`Tidak ada pekerjaan orang tua untuk latar keluarga ${backgroundTier}.`);
  }

  const value = random();
  const roll = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
  return candidates[Math.floor(roll * candidates.length)].id;
}

export function getMonthlyParentalSupport(character: Character): number {
  if (character.age >= 18) return 0;
  const familyBackground = getFamilyBackground(character.familyBackground.tier);
  const parentIncome = character.family.members
    .filter((member) => (
      (member.role === 'father' || member.role === 'mother')
      && member.status === 'alive'
    ))
    .reduce((total, member) => (
      total + (getOccupation(member.occupationId ?? null)?.monthlySalary ?? 0)
    ), 0);
  const support = parentIncome
    * getNominalPriceFactor(character.currentYear)
    * familyBackground.monthlySupportRate;
  return Number.isFinite(support)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(support)))
    : 0;
}

export interface MonthlyFamilySupportResult {
  character: Character;
  income: number;
  historyEntries: string[];
}

export function processMonthlyFamilySupport(character: Character): MonthlyFamilySupportResult {
  const income = getMonthlyParentalSupport(character);
  if (income === 0) return { character, income, historyEntries: [] };

  const parents = character.family.members
    .filter((member) => (
      (member.role === 'father' || member.role === 'mother')
      && member.status === 'alive'
    ))
    .map((member) => member.name);
  const entry = `${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Menerima kiriman uang dari ${parents.join(' dan ')} sebesar ${income}.`;
  return {
    character: {
      ...character,
      cash: character.cash + income,
      netWorth: character.netWorth + income,
      lastYearIncome: character.lastYearIncome + income,
      economyRecord: {
        ...character.economyRecord,
        history: [...(character.economyRecord?.history ?? []), entry],
      },
    },
    income,
    historyEntries: [entry],
  };
}
