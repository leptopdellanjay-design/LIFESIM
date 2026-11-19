import type { Character, EventProgress } from '../types/game';
import { createEmptyEventProgress } from './eventEngine';
import { simulateMonth, type MonthlySimulationResult } from './simulationEngine';

export interface YearlySimulationResult extends MonthlySimulationResult {
  monthsAdvanced: number;
}

export function advanceMonth(
  character: Character,
  eventProgress: EventProgress = createEmptyEventProgress(),
  random: () => number = Math.random,
): MonthlySimulationResult {
  return simulateMonth(character, eventProgress, random);
}

export function advanceYear(
  character: Character,
  eventProgress: EventProgress = createEmptyEventProgress(),
  random: () => number = Math.random,
  monthsToAdvance = 12,
): YearlySimulationResult {
  let nextCharacter = character;
  let nextEventProgress = eventProgress;
  let activeEvent: MonthlySimulationResult['activeEvent'] = null;
  const historyEntries: string[] = [];
  let monthsAdvanced = 0;
  const monthLimit = Number.isFinite(monthsToAdvance)
    ? Math.max(0, Math.min(12, Math.floor(monthsToAdvance)))
    : 12;

  while (monthsAdvanced < monthLimit && nextCharacter.status === 'alive' && !activeEvent) {
    const result = advanceMonth(nextCharacter, nextEventProgress, random);
    nextCharacter = result.character;
    nextEventProgress = result.eventProgress;
    activeEvent = result.activeEvent;
    historyEntries.push(...result.historyEntries);
    monthsAdvanced += 1;
  }

  return {
    character: nextCharacter,
    activeEvent,
    eventProgress: nextEventProgress,
    historyEntries,
    monthsAdvanced,
  };
}
