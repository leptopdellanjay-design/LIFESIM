import type { Character } from '../types/game';
import { processAnnualCareer } from './careerEngine';
import { processEconomyYear } from './economyEngine';

export interface AnnualEconomyResult {
  character: Character;
  income: number;
  expenses: number;
  historyEntries: string[];
}

export function processAnnualEconomy(character: Character): AnnualEconomyResult {
  const career = processAnnualCareer(character);
  const economy = processEconomyYear(career.character);
  return {
    character: economy.character,
    income: career.income + economy.income,
    expenses: career.expenses + economy.expenses,
    historyEntries: [...career.historyEntries, ...economy.historyEntries],
  };
}
