import type { Character } from '../types/game';
import { processAnnualCareer, processMonthlyCareer } from './careerEngine';
import { processMonthlyFamilySupport } from './familySupport';
import { processEconomyMonth, processEconomyYear } from './economyEngine';

export interface AnnualEconomyResult {
  character: Character;
  income: number;
  expenses: number;
  historyEntries: string[];
}

export interface MonthlyEconomyResult {
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

export function processMonthlyEconomy(
  character: Character,
  month: number,
  random: () => number = Math.random,
): MonthlyEconomyResult {
  const familySupport = processMonthlyFamilySupport(character);
  const career = processMonthlyCareer(familySupport.character, month);
  const economy = processEconomyMonth(career.character, month, random);
  return {
    character: economy.character,
    income: familySupport.income + career.income + economy.income,
    expenses: career.expenses + economy.expenses,
    historyEntries: [...familySupport.historyEntries, ...career.historyEntries, ...economy.historyEntries],
  };
}
