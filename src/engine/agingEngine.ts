import type { Character, EventProgress } from '../types/game';
import { createEmptyEventProgress } from './eventEngine';
import { simulateYear, type AnnualSimulationResult } from './simulationEngine';

export function ageUp(
  character: Character,
  eventProgress: EventProgress = createEmptyEventProgress(),
  random: () => number = Math.random,
): AnnualSimulationResult {
  return simulateYear(character, eventProgress, random);
}
