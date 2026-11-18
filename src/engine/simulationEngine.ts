import type {
  Character,
  EventProgress,
  LifeEvent,
} from '../types/game';
import { processAnnualEconomy } from './careerEconomyEngine';
import { simulateEducationYear } from './educationEngine';
import {
  consumePendingEvent,
  createEmptyEventProgress,
  processPendingConsequences,
  selectLifeEvent,
} from './eventEngine';
import { getLifeStage } from './lifeStages';
import { processFamilyYear } from './familyEngine';

export interface AnnualSimulationResult {
  character: Character;
  activeEvent: LifeEvent | null;
  eventProgress: EventProgress;
  historyEntries: string[];
}

const clampStat = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function createFamilyYearRandom(characterId: string, year: number): () => number {
  let state = 2166136261;
  for (const character of `${characterId}:${year}`) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function developStats(character: Character): Character {
  const age = character.age;
  const stats = { ...character.stats };

  if (age <= 2) {
    stats.health = clampStat(stats.health + 1);
    stats.energy = clampStat(stats.energy + 1);
    stats.intelligence = clampStat(stats.intelligence + 1);
  } else if (age <= 12) {
    stats.health = clampStat(stats.health + 1);
    stats.intelligence = clampStat(stats.intelligence + 1);
  } else if (age <= 18) {
    stats.intelligence = clampStat(stats.intelligence + 1);
  }

  if (age >= 50) stats.energy = clampStat(stats.energy - 1);
  if (age >= 60) stats.health = clampStat(stats.health - 1);
  if (age >= 65 && age % 5 === 0) stats.looks = clampStat(stats.looks - 1);

  return { ...character, stats };
}

function developFamilyRelationships(character: Character): Character {
  if (character.age > 17) return character;
  return {
    ...character,
    family: {
      ...character.family,
      members: character.family.members.map((member) => (
        member.status === 'alive'
          ? { ...member, relationship: Math.min(100, member.relationship + 1) }
          : member
      )),
    },
  };
}

function getAnnualDeathRisk(character: Character): number {
  const baseRisk = character.age < 3
    ? 0.001
    : character.age < 18
      ? 0.0001
      : character.age < 60
        ? 0.0005
        : character.age < 75
          ? 0.01
          : 0.03;
  const healthRisk = ((100 - character.stats.health) / 100)
    * (character.age >= 60 ? 0.08 : 0.005);
  return Math.min(0.85, baseRisk + healthRisk);
}

export function simulateYear(
  character: Character,
  eventProgress: EventProgress = createEmptyEventProgress(),
  random: () => number = Math.random,
): AnnualSimulationResult {
  if (character.status !== 'alive') {
    return { character, activeEvent: null, eventProgress, historyEntries: [] };
  }

  const previousStage = getLifeStage(character.age);
  let nextCharacter: Character = {
    ...character,
    age: character.age + 1,
    currentYear: character.currentYear + 1,
    lastYearIncome: 0,
    lastYearExpenses: 0,
  };
  nextCharacter = developStats(nextCharacter);
  nextCharacter = developFamilyRelationships(nextCharacter);
  const education = simulateEducationYear(nextCharacter, random);
  nextCharacter = education.character;
  const economy = processAnnualEconomy(nextCharacter);
  nextCharacter = economy.character;
  const delayed = processPendingConsequences(nextCharacter, eventProgress);
  nextCharacter = delayed.character;
  let nextEventProgress = delayed.eventProgress;
  const familyYear = processFamilyYear(
    nextCharacter,
    createFamilyYearRandom(nextCharacter.id, nextCharacter.currentYear),
  );
  nextCharacter = familyYear.character;

  const stage = getLifeStage(nextCharacter.age);
  const historyEntries = [
    `${nextCharacter.currentYear}: Bertambah usia menjadi ${nextCharacter.age} tahun — ${stage.label}.`,
  ];
  if (previousStage.id !== stage.id) {
    historyEntries.push(`${nextCharacter.currentYear}: Memasuki tahap ${stage.label.toLowerCase()}.`);
  }
  historyEntries.push(...education.historyEntries);
  historyEntries.push(...economy.historyEntries);
  historyEntries.push(...delayed.historyEntries);
  historyEntries.push(...familyYear.historyEntries);

  const deathRoll = random();
  const safeDeathRoll = Number.isFinite(deathRoll) ? Math.max(0, Math.min(0.999999999, deathRoll)) : 0.5;
  if (safeDeathRoll < getAnnualDeathRisk(nextCharacter)) {
    const cause = nextCharacter.stats.health <= 25
      ? 'Komplikasi kesehatan dalam simulasi'
      : 'Penyebab alami dalam simulasi';
    nextCharacter = {
      ...nextCharacter,
      status: 'deceased',
      deathRecord: {
        age: nextCharacter.age,
        year: nextCharacter.currentYear,
        cause,
      },
    };
    historyEntries.push(
      `${nextCharacter.currentYear}: Kehidupan berakhir pada usia ${nextCharacter.age}. Penyebab: ${cause}.`,
    );
    return {
      character: nextCharacter,
      activeEvent: null,
      eventProgress: nextEventProgress,
      historyEntries,
    };
  }

  const activeEvent = selectLifeEvent(nextCharacter, nextEventProgress, random);
  if (activeEvent) {
    historyEntries.push(`${nextCharacter.currentYear}: Kejadian tersedia — ${activeEvent.title}.`);
    nextEventProgress = consumePendingEvent(nextEventProgress, activeEvent.id);
  }

  return {
    character: nextCharacter,
    activeEvent,
    eventProgress: nextEventProgress,
    historyEntries,
  };
}

export { getAnnualDeathRisk };
