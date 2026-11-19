import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import { getAnnualDeathRisk, simulateMonth } from './simulationEngine';
import { getLifeStage } from './lifeStages';
import { createEducationRecordFromLegacy } from './educationEngine';
import { createCareerRecordFromLegacy } from './careerEngine';
import { getMonthlyParentalSupport } from './familySupport';

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

describe('monthly simulation', () => {
  it('advances one month and ages the character only on their birthday', () => {
    const character = makeCharacter();
    const firstMonth = simulateMonth(character, undefined, () => 0.99).character;

    expect(firstMonth.currentYear).toBe(2000);
    expect(firstMonth.currentMonth).toBe(6);
    expect(firstMonth.age).toBe(0);

    let afterBirthday = character;
    for (let month = 0; month < 12; month += 1) {
      afterBirthday = simulateMonth(afterBirthday, undefined, () => 0.99).character;
    }
    expect(afterBirthday.currentYear).toBe(2001);
    expect(afterBirthday.currentMonth).toBe(5);
    expect(afterBirthday.age).toBe(1);
    expect(afterBirthday.stats.health).toBe(character.stats.health + 1);
  });

  it('advances school milestones on the birthday month', () => {
    const character = makeCharacter({
      age: 5,
      currentYear: 2025,
      currentMonth: 4,
      educationRecord: createEducationRecordFromLegacy('Taman Kanak-kanak', 2025),
    });
    const result = simulateMonth(character, undefined, () => 0.99);

    expect(result.character.currentMonth).toBe(5);
    expect(result.character.age).toBe(6);
    expect(result.character.educationRecord.currentLevel).toBe('sd');
    expect(result.historyEntries).toContain('2025: Memulai Sekolah Dasar.');
  });

  it('updates monthly income and expenses without waiting for year end', () => {
    const character = makeCharacter({
      age: 30,
      currentYear: 2020,
      currentMonth: 4,
      careerRecord: createCareerRecordFromLegacy('Pekerja pemula', 2020),
      cash: 100_000,
      netWorth: 500_000,
    });
    const result = simulateMonth(character, undefined, () => 0.99);

    expect(result.character.currentMonth).toBe(5);
    expect(result.character.lastYearIncome).toBeGreaterThan(0);
    expect(result.character.lastYearExpenses).toBeGreaterThan(0);
    expect(result.character.cash).toBeGreaterThan(character.cash);
    expect(result.character.netWorth).toBeGreaterThan(character.netWorth);
  });

  it('records monthly parental support as income and cash for a dependent child', () => {
    const character = makeCharacter({
      age: 17,
      currentYear: 2020,
      currentMonth: 5,
      cash: 0,
      netWorth: 0,
    });
    const support = getMonthlyParentalSupport(character);
    const result = simulateMonth(character, undefined, () => 0.99);

    expect(support).toBeGreaterThan(0);
    expect(result.character.cash).toBe(character.cash + support);
    expect(result.character.lastYearIncome).toBe(support);
    expect(result.historyEntries.some((entry) => entry.includes('kiriman uang dari Ayah dan Ibu'))).toBe(true);
    expect(result.character.economyRecord.history.some((entry) => entry.includes('kiriman uang dari'))).toBe(true);
  });

  it('rolls December into January and starts new totals with January income', () => {
    const character = makeCharacter({
      currentYear: 2025,
      currentMonth: 12,
      lastYearIncome: 2_000_000,
      lastYearExpenses: 1_000_000,
    });
    const result = simulateMonth(character, undefined, () => 0.99);

    expect(result.character.currentYear).toBe(2026);
    expect(result.character.currentMonth).toBe(1);
    expect(result.character.age).toBe(0);
    expect(result.character.lastYearIncome).toBe(
      getMonthlyParentalSupport({ ...character, currentYear: 2026, currentMonth: 1 }),
    );
    expect(result.character.lastYearExpenses).toBe(0);
  });

  it('records a probabilistic death with age, year, and cause', () => {
    const result = simulateMonth(makeCharacter(), undefined, () => 0);

    expect(result.character.status).toBe('deceased');
    expect(result.character.deathRecord).toEqual({
      age: 0,
      year: 2000,
      month: 6,
      cause: 'Penyebab alami dalam simulasi',
    });
    expect(result.character.estateSettlement).toMatchObject({
      year: 2000,
      netValue: result.character.netWorth,
      shares: [],
    });
    expect(result.activeEvent).toBeNull();
  });

  it('preserves nonzero annual death risk and applies aging on a senior birthday', () => {
    const senior = makeCharacter({
      age: 59,
      currentYear: 2059,
      currentMonth: 4,
      stats: { ...makeCharacter().stats, health: 50, energy: 50 },
    });
    const result = simulateMonth(senior, undefined, () => 0.99);
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
