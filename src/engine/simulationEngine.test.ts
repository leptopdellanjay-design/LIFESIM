import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import { getAnnualDeathRisk, simulateYear } from './simulationEngine';
import { getLifeStage } from './lifeStages';
import { createEducationRecordFromLegacy } from './educationEngine';
import { createCareerRecordFromLegacy } from './careerEngine';

function makeCharacter(overrides: Record<string, unknown> = {}) {
  const character = createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '2000-05-21',
    familyBackground: 'modest',
    parentCondition: 'both_alive',
    personalityTraits: ['disciplined'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'simulation-character',
  });
  return { ...character, ...overrides } as typeof character;
}

describe('life stages', () => {
  it.each([
    [0, 'baby'],
    [2, 'baby'],
    [3, 'toddler'],
    [5, 'toddler'],
    [6, 'child'],
    [12, 'child'],
    [13, 'teenager'],
    [17, 'teenager'],
    [18, 'young_adult'],
    [25, 'young_adult'],
    [26, 'adult'],
    [40, 'adult'],
    [41, 'middle_age'],
    [59, 'middle_age'],
    [60, 'senior'],
    [74, 'senior'],
    [75, 'elderly'],
  ] as const)('maps age %i to %s', (age, stage) => {
    expect(getLifeStage(age).id).toBe(stage);
  });
});

describe('simulateYear', () => {
  it('updates age, year, child development, family ties, and annual history together', () => {
    const character = makeCharacter();
    const result = simulateYear(character, undefined, () => 0.99);

    expect(result.character.age).toBe(1);
    expect(result.character.currentYear).toBe(2001);
    expect(result.character.stats.health).toBe(character.stats.health + 1);
    expect(result.character.stats.energy).toBe(character.stats.energy + 1);
    expect(result.character.family.members[0].relationship).toBe(66);
    expect(result.historyEntries[0]).toContain('Bertambah usia menjadi 1 tahun');
    expect(result.activeEvent).toBeNull();
  });

  it('advances education at the supported school-age milestones', () => {
    const character = makeCharacter({
      age: 5,
      currentYear: 2025,
      educationRecord: createEducationRecordFromLegacy('Taman Kanak-kanak', 2025),
    });
    const result = simulateYear(character, undefined, () => 0.99);

    expect(result.character.educationRecord.currentLevel).toBe('sd');
    expect(result.historyEntries).toContain('2026: Memulai Sekolah Dasar.');
  });

  it('integrates child development and family history into Age Up', () => {
    const character = makeCharacter({
      age: 25,
      currentYear: 2025,
      children: [{
        id: 'child-test',
        name: 'Bima',
        birthYear: 2019,
        relationship: 60,
        trust: 55,
        health: 70,
        happiness: 60,
        intelligence: 50,
        educationLevel: 'none',
        lifeStatus: 'alive',
        parentingStyle: 'supportive',
      }],
    });
    const result = simulateYear(character, undefined, () => 0.99);

    expect(result.character.currentYear).toBe(2026);
    expect(result.character.children[0].educationLevel).toBe('sd');
    expect(result.character.children[0].relationship).toBe(62);
    expect(result.historyEntries).toContain('2026: Bima mulai sekolah dasar.');
  });

  it('opens an age-appropriate school event after the year is processed', () => {
    const character = makeCharacter({
      age: 5,
      currentYear: 2025,
      educationRecord: createEducationRecordFromLegacy('Taman Kanak-kanak', 2025),
    });
    const rolls = [0.99, 0, 0];
    const result = simulateYear(character, undefined, () => rolls.shift() ?? 0);

    expect(result.activeEvent?.id).toBe('first-school-day');
    expect(result.historyEntries.some((entry) => entry.includes('Kejadian tersedia'))).toBe(true);
  });

  it('processes age-aware employment income without merging it with the wealth stat', () => {
    const character = makeCharacter({
      age: 17,
      currentYear: 2017,
      careerRecord: createCareerRecordFromLegacy('Pekerja pemula', 2017),
      cash: 100000,
      netWorth: 500000,
    });
    const result = simulateYear(character, undefined, () => 0.99);

    expect(result.character.age).toBe(18);
    expect(result.character.lastYearIncome).toBeGreaterThan(0);
    expect(result.character.lastYearExpenses).toBeGreaterThan(0);
    expect(result.character.cash).toBeGreaterThan(100000);
    expect(result.character.netWorth).toBeGreaterThan(500000);
    expect(result.character.stats.wealth).toBe(character.stats.wealth + 1);
  });

  it('records a probabilistic death with age, year, and cause', () => {
    const result = simulateYear(makeCharacter(), undefined, () => 0);

    expect(result.character.status).toBe('deceased');
    expect(result.character.deathRecord).toEqual({
      age: 1,
      year: 2001,
      cause: 'Penyebab alami dalam simulasi',
    });
    expect(result.activeEvent).toBeNull();
    expect(result.historyEntries[result.historyEntries.length - 1]).toContain('Kehidupan berakhir');
  });

  it('does not make old age an automatic death trigger', () => {
    const character = makeCharacter({
      age: 100,
      currentYear: 2100,
      stats: { ...makeCharacter().stats, health: 100 },
    });
    const result = simulateYear(character, undefined, () => 0.999);

    expect(getAnnualDeathRisk(result.character)).toBeGreaterThan(0);
    expect(result.character.status).toBe('alive');
    expect(result.character.deathRecord).toBeNull();
  });

  it('gradually changes health and energy in senior years and raises risk with poor health', () => {
    const senior = makeCharacter({
      age: 59,
      currentYear: 2059,
      stats: { ...makeCharacter().stats, health: 50, energy: 50 },
    });
    const result = simulateYear(senior, undefined, () => 0.99);
    const healthySenior = { ...result.character, stats: { ...result.character.stats, health: 100 } };

    expect(result.character.age).toBe(60);
    expect(result.character.stats.health).toBe(49);
    expect(result.character.stats.energy).toBe(49);
    expect(getAnnualDeathRisk(result.character)).toBeGreaterThan(getAnnualDeathRisk(healthySenior));
    expect(getAnnualDeathRisk(healthySenior)).toBeGreaterThan(
      getAnnualDeathRisk({ ...healthySenior, age: 30 }),
    );
  });
});
