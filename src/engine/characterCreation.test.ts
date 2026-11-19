import { describe, expect, it } from 'vitest';
import { familyBackgrounds } from '../data/familyBackgrounds';
import { getOccupation } from '../data/careerCatalog';
import { getCities, getProvinces, isSupportedLocation } from '../data/locations';
import { CharacterDraftError, createCharacter, initialCharacterDraft, validateCharacterDraft } from './characterCreation';
import { getMonthlyParentalSupport } from './familySupport';
import { adjustEventWeightForPersonality, getNominalPriceFactor, getWorldYearContext } from './worldEra';
import type { CharacterDraft } from '../types/game';

const today = new Date('2026-11-18T12:00:00');

function validDraft(overrides: Partial<CharacterDraft> = {}): CharacterDraft {
  return {
    ...initialCharacterDraft,
    firstName: 'Ayu',
    lastName: 'Pratama',
    gender: 'female',
    birthDate: '2000-05-21',
    familyBackground: 'modest',
    parentCondition: 'both_alive',
    siblingCount: 1,
    personalityTraits: ['friendly', 'creative'],
    ...overrides,
  };
}

describe('character creation validation', () => {
  it('requires a non-empty name', () => {
    const errors = validateCharacterDraft(validDraft({ firstName: '  ' }), today);
    expect(errors.firstName).toBe('Nama depan wajib diisi.');
    expect(() => createCharacter(validDraft({ firstName: '' }), { today })).toThrow(CharacterDraftError);
  });

  it('rejects invalid and future birth dates', () => {
    expect(validateCharacterDraft(validDraft({ birthDate: '2001-02-29' }), today).birthDate).toContain('valid');
    expect(validateCharacterDraft(validDraft({ birthDate: '2027-01-01' }), today).birthDate).toContain('masa depan');
    expect(validateCharacterDraft(validDraft({ birthDate: '1899-12-31' }), today).birthDate).toContain('1900');
  });

  it('requires a city belonging to the selected province', () => {
    const mismatchedLocation = validDraft({ province: 'Sumatera Barat', city: 'Bandung' });
    expect(validateCharacterDraft(mismatchedLocation, today).city).toContain('provinsi');
    expect(isSupportedLocation('ID', 'Sumatera Barat', 'Padang')).toBe(true);
    expect(getCities('ID', 'Jawa Barat')).toContain('Bandung');
  });

  it('provides location lists for all Indonesian provinces', () => {
    expect(getProvinces('ID')).toHaveLength(38);
    expect(getProvinces('US')).toEqual([]);
  });

  it('creates a newborn with a year-aware birth record and family relations', () => {
    const character = createCharacter(validDraft({ birthDate: '1950-06-01', siblingCount: 2 }), {
      today,
      idFactory: () => 'new-character',
    });
    expect(character.age).toBe(0);
    expect(character.currentYear).toBe(1950);
    expect(character.birthInformation.location.city).toBe('Padang');
    expect(character.birthEvent.title).toBe('Hari kelahiran');
    expect(character.birthEvent.statChanges.happiness).toBe(1);
    expect(character.stats.happiness).toBe(70);
    expect(character.family.members.filter((member) => member.role === 'sibling')).toHaveLength(2);
    expect(character.family.members.find((member) => member.role === 'father')?.status).toBe('alive');
    expect(character.stats.wealth).not.toBe(character.cash);
    expect(character.netWorth).toBeGreaterThanOrEqual(character.cash);
  });

  it('creates a guardian for a character whose parents are deceased', () => {
    const character = createCharacter(validDraft({ parentCondition: 'both_deceased' }), { today });
    expect(character.family.livingArrangement).toBe('with_guardian');
    expect(character.family.members.find((member) => member.role === 'guardian')?.status).toBe('alive');
    expect(character.family.members.filter((member) => member.status === 'deceased')).toHaveLength(2);
  });

  it('gives each economic background distinct starting resources and bounded stats', () => {
    const created = familyBackgrounds.map((background) => createCharacter(
      validDraft({ familyBackground: background.id }),
      { today },
    ));
    expect(new Set(created.map((character) => character.cash)).size).toBe(created.length);
    expect(new Set(created.map((character) => character.startingAssets.housingCondition)).size).toBeGreaterThan(1);
    for (const character of created) {
      for (const value of Object.values(character.stats)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
    expect(created[5].stats.wealth).toBeLessThan(100);
  });

  it('assigns parent jobs within each family tier and calculates support by income and parent status', () => {
    const characters = familyBackgrounds.map((background) => createCharacter(
      validDraft({ familyBackground: background.id }),
      { today, random: () => 0.5 },
    ));

    for (const character of characters) {
      const { parentSalaryRange } = familyBackgrounds.find(
        (background) => background.id === character.familyBackground.tier,
      )!;
      for (const parent of character.family.members.filter((member) => (
        (member.role === 'father' || member.role === 'mother') && member.status === 'alive'
      ))) {
        const salary = getOccupation(parent.occupationId ?? null)?.monthlySalary;
        expect(salary).toBeGreaterThanOrEqual(parentSalaryRange[0]);
        expect(salary).toBeLessThanOrEqual(parentSalaryRange[1]);
      }
    }

    const twoParents = characters.find((character) => character.familyBackground.tier === 'middle')!;
    const oneParent = createCharacter(validDraft({
      familyBackground: 'middle',
      parentCondition: 'father_only',
    }), { today, random: () => 0.5 });
    expect(getMonthlyParentalSupport(twoParents)).toBeGreaterThan(
      getMonthlyParentalSupport(oneParent),
    );
    expect(getMonthlyParentalSupport(characters[5])).toBeGreaterThan(
      getMonthlyParentalSupport(characters[0]),
    );
    expect(oneParent.family.members.find((member) => member.role === 'mother')?.occupationId).toBeNull();
    expect(getMonthlyParentalSupport({ ...twoParents, age: 18 })).toBe(0);
    expect(getMonthlyParentalSupport({
      ...twoParents,
      family: {
        ...twoParents.family,
        members: twoParents.family.members.map((member) => (
          member.role === 'father' || member.role === 'mother'
            ? { ...member, status: 'deceased' as const }
            : member
        )),
      },
    })).toBe(0);
  });

  it('scales starting resources by the birth year without changing the currency', () => {
    const older = createCharacter(validDraft({ birthDate: '1950-05-21' }), { today });
    const modern = createCharacter(validDraft({ birthDate: '2026-05-21' }), { today });
    expect(older.cash).toBeLessThan(modern.cash);
    expect(older.birthInformation.location.currencyCode).toBe('IDR');
    expect(getNominalPriceFactor(1950)).toBeLessThan(getNominalPriceFactor(2026));
  });

  it('keeps event personality bonuses weighted rather than absolute', () => {
    const baseWeight = 100;
    const adjusted = adjustEventWeightForPersonality(baseWeight, 'education', { traits: ['intelligent'] });
    expect(adjusted).toBeGreaterThan(baseWeight);
    expect(adjusted).toBeLessThan(150);
    expect(adjustEventWeightForPersonality(baseWeight, 'unrelated', { traits: ['intelligent'] })).toBe(baseWeight);
  });

  it('does not expose smartphone technology before its introduction year', () => {
    expect(getWorldYearContext(1900).decadeLabel).toBe('Era 1900-an');
    expect(getWorldYearContext(1950).smartphoneAvailable).toBe(false);
    expect(getWorldYearContext(2006).technologySummary).toContain('belum tersedia');
    expect(getWorldYearContext(2007).smartphoneAvailable).toBe(true);
  });
});
