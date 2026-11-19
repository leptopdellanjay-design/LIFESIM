import type {
  Character,
  EventProgress,
  LifeEvent,
} from '../types/game';
import { getBirthdayMonth, getNextCalendarDate } from './calendar';
import { processMonthlyEconomy } from './careerEconomyEngine';
import { simulateEducationMonth } from './educationEngine';
import {
  consumePendingEvent,
  createEmptyEventProgress,
  processPendingConsequences,
  selectLifeEvent,
} from './eventEngine';
import { getLifeStage } from './lifeStages';
import { processFamilyYear } from './familyEngine';
import { settleEstateOnDeath } from './successionEngine';
import { processDigitalLifeMonth } from './digitalLifeEngine';

export interface MonthlySimulationResult {
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
  const economicRisk = character.age >= 60 && character.stats.wealth < 15
    ? 0.006
    : character.age >= 60 && character.stats.wealth < 30
      ? 0.003
      : 0;
  return Math.max(0, Math.min(0.85, baseRisk + healthRisk + economicRisk));
}

export interface LifespanEstimate {
  expectedAge: number;
  likelyAgeRange: [number, number];
  currentAnnualRisk: number;
  factors: string[];
}

export function getLifespanEstimate(character: Character): LifespanEstimate | null {
  if (character.status !== 'alive') return null;

  let survivalProbability = 1;
  let expectedAge = 0;
  let deathProbabilityAccumulated = 0;
  let lowerAge = character.age;
  let upperAge = character.age;
  let lowerFound = false;
  let upperFound = false;
  const projectedHealth = Math.max(0, Math.min(100, character.stats.health));
  const factors = character.stats.health < 45
    ? ['Kesehatan rendah meningkatkan risiko simulasi.']
    : character.stats.health >= 80
      ? ['Kondisi kesehatan saat ini menurunkan risiko dibanding karakter dengan kesehatan rendah.']
      : [];
  if (character.stats.wealth < 15) {
    factors.push('Kondisi ekonomi rendah sedikit meningkatkan risiko pada usia lanjut.');
  } else if (character.stats.wealth >= 70) {
    factors.push('Kondisi ekonomi baik mengurangi sebagian risiko pada usia lanjut.');
  }
  factors.push('Risiko meningkat seiring usia; perkiraan bukan tanggal kematian pasti.');

  for (let age = character.age + 1; age <= 120; age += 1) {
    const yearsAboveSixty = Math.max(0, age - Math.max(60, character.age));
    const futureHealth = Math.max(0, projectedHealth - yearsAboveSixty);
    const risk = getAnnualDeathRisk({
      ...character,
      age,
      stats: { ...character.stats, health: futureHealth },
    });
    const deathProbability = survivalProbability * risk;
    deathProbabilityAccumulated += deathProbability;
    expectedAge += age * deathProbability;
    survivalProbability *= 1 - risk;

    if (!lowerFound && deathProbabilityAccumulated >= 0.1) {
      lowerAge = age;
      lowerFound = true;
    }
    if (!upperFound && deathProbabilityAccumulated >= 0.9) {
      upperAge = age;
      upperFound = true;
    }
  }
  expectedAge += 121 * survivalProbability;

  return {
    expectedAge: Math.round(expectedAge),
    likelyAgeRange: [lowerAge, upperFound ? upperAge : 120],
    currentAnnualRisk: getAnnualDeathRisk(character),
    factors,
  };
}

export function simulateMonth(
  character: Character,
  eventProgress: EventProgress = createEmptyEventProgress(),
  random: () => number = Math.random,
): MonthlySimulationResult {
  if (character.status !== 'alive') {
    return { character, activeEvent: null, eventProgress, historyEntries: [] };
  }

  const previousMonth = character.currentMonth ?? 1;
  const nextDate = getNextCalendarDate(character.currentYear, previousMonth);
  const isBirthday = nextDate.month === getBirthdayMonth(character.birthInformation.date);
  const isNewYear = nextDate.month === 1;
  const previousStage = getLifeStage(character.age);
  let nextCharacter: Character = {
    ...character,
    age: character.age + (isBirthday ? 1 : 0),
    currentYear: nextDate.year,
    currentMonth: nextDate.month,
    lastYearIncome: nextDate.year !== character.currentYear ? 0 : character.lastYearIncome,
    lastYearExpenses: nextDate.year !== character.currentYear ? 0 : character.lastYearExpenses,
  };
  const historyEntries: string[] = [];
  if (isBirthday) {
    nextCharacter = developStats(nextCharacter);
    nextCharacter = developFamilyRelationships(nextCharacter);
    const stage = getLifeStage(nextCharacter.age);
    historyEntries.push(
      `${nextCharacter.currentYear}-${String(nextCharacter.currentMonth).padStart(2, '0')}: Bertambah usia menjadi ${nextCharacter.age} tahun — ${stage.label}.`,
    );
    if (previousStage.id !== stage.id) {
      historyEntries.push(`${nextCharacter.currentYear}: Memasuki tahap ${stage.label.toLowerCase()}.`);
    }
  }

  const education = simulateEducationMonth(nextCharacter, nextDate.month, isBirthday, random);
  nextCharacter = education.character;
  const economy = processMonthlyEconomy(nextCharacter, nextDate.month, random);
  nextCharacter = economy.character;
  const digitalLife = processDigitalLifeMonth(nextCharacter);
  nextCharacter = digitalLife.character;
  if (nextDate.month === 12) {
    const annualBalance = nextCharacter.lastYearIncome - nextCharacter.lastYearExpenses;
    const wealthChange = annualBalance > 0 ? 1 : annualBalance < 0 ? -1 : 0;
    nextCharacter = {
      ...nextCharacter,
      stats: {
        ...nextCharacter.stats,
        wealth: clampStat(nextCharacter.stats.wealth + wealthChange),
      },
    };
  }
  let nextEventProgress = eventProgress;
  historyEntries.push(...education.historyEntries, ...economy.historyEntries, ...digitalLife.historyEntries);

  if (isNewYear) {
    const delayed = processPendingConsequences(nextCharacter, nextEventProgress);
    nextCharacter = delayed.character;
    nextEventProgress = delayed.eventProgress;
    historyEntries.push(...delayed.historyEntries);
    const familyYear = processFamilyYear(
      nextCharacter,
      createFamilyYearRandom(nextCharacter.id, nextCharacter.currentYear),
    );
    nextCharacter = familyYear.character;
    historyEntries.push(...familyYear.historyEntries);
  }

  const deathRoll = random();
  const safeDeathRoll = Number.isFinite(deathRoll) ? Math.max(0, Math.min(0.999999999, deathRoll)) : 0.5;
  const monthlyDeathRisk = 1 - ((1 - getAnnualDeathRisk(nextCharacter)) ** (1 / 12));
  if (safeDeathRoll < monthlyDeathRisk) {
    const cause = nextCharacter.stats.health <= 25
      ? 'Komplikasi kesehatan dalam simulasi'
      : 'Penyebab alami dalam simulasi';
    nextCharacter = {
      ...nextCharacter,
      status: 'deceased',
      deathRecord: {
        age: nextCharacter.age,
        year: nextCharacter.currentYear,
        month: nextCharacter.currentMonth,
        cause,
      },
    };
    const settlement = settleEstateOnDeath(nextCharacter);
    nextCharacter = settlement.character;
    historyEntries.push(...settlement.historyEntries);
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
    const momentLabel = activeEvent.calendarMomentType === 'national'
      ? 'Momen nasional'
      : activeEvent.calendarMomentType === 'annual'
        ? 'Momen tahunan'
        : 'Momen acak';
    historyEntries.push(
      `${nextCharacter.currentYear}-${String(nextCharacter.currentMonth).padStart(2, '0')}: ${momentLabel} tersedia — ${activeEvent.title}.`,
    );
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
