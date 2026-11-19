import { describe, expect, it } from 'vitest';
import type { ChildRecord, SocialRelationship } from '../types/game';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  createChild,
  normalizeFamilyRecords,
  processFamilyYear,
  setChildParentingStyle,
} from './familyEngine';

function makeCharacter() {
  const character = createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '1980-05-21',
    familyBackground: 'middle',
    parentCondition: 'both_alive',
    personalityTraits: ['friendly'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'family-character',
  });
  return { ...character, age: 30, currentYear: 2010 };
}

function spouse(): SocialRelationship {
  return {
    id: 'spouse',
    name: 'Dara',
    kind: 'spouse',
    score: 75,
    trust: 72,
    loyalty: 70,
    status: 'active',
    stage: 'married',
    startedYear: 2008,
    profile: {
      age: 28,
      gender: 'female',
      personality: { traits: [] },
      occupationId: null,
      educationLevel: 'sma',
      netWorth: 0,
      health: 90,
      lifeStatus: 'alive',
    },
    history: [],
  };
}

function makeMarriedCharacter() {
  return {
    ...makeCharacter(),
    maritalStatus: 'married' as const,
    spouseName: 'Dara',
    relationships: [spouse()],
  };
}

describe('family engine', () => {
  it('requires an active marriage and records a child in the canonical family data', () => {
    const single = makeCharacter();
    expect(createChild(single, 'Bima')).toBeNull();

    const married = makeMarriedCharacter();
    const result = createChild(married, 'Bima')!;
    expect(result.character.children).toHaveLength(1);
    expect(result.character.children[0]).toMatchObject({
      name: 'Bima',
      birthYear: married.currentYear,
      lifeStatus: 'alive',
      educationLevel: 'none',
      parentIds: ['family-character', 'spouse'],
      generation: 1,
    });
    expect(result.character.family.history).toContain('2010: Menyambut kelahiran Bima.');
  });

  it('develops children, education, and parent-child trust across years', () => {
    const married = makeMarriedCharacter();
    const child: ChildRecord = {
      id: 'child-test',
      name: 'Bima',
      birthYear: 2017,
      relationship: 60,
      trust: 55,
      health: 70,
      happiness: 60,
      intelligence: 50,
      educationLevel: 'none',
      lifeStatus: 'alive',
      parentingStyle: 'supportive',
    };
    const result = processFamilyYear({
      ...married,
      currentYear: 2023,
      children: [child],
    }, () => 0.99);
    const updatedChild = result.character.children[0];

    expect(updatedChild.educationLevel).toBe('sd');
    expect(updatedChild.relationship).toBe(62);
    expect(updatedChild.trust).toBe(57);
    expect(result.historyEntries).toContain('2023: Bima mulai sekolah dasar.');
    expect(result.character.lastYearExpenses).toBeGreaterThan(0);
    expect(result.character.cash).toBeLessThan(married.cash);
  });

  it('applies parenting choices to subsequent child development', () => {
    const married = makeMarriedCharacter();
    const created = createChild(married, 'Bima')!;
    const childId = created.character.children[0].id;
    const setStyle = setChildParentingStyle(created.character, childId, 'supportive')!;
    const result = processFamilyYear({
      ...setStyle.character,
      currentYear: 2011,
    }, () => 0.99);

    expect(result.character.children[0].parentingStyle).toBe('supportive');
    expect(result.character.children[0].relationship).toBe(67);
    expect(result.character.children[0].happiness).toBe(67);
  });

  it('records family death and transfers inheritance only once', () => {
    const character = makeCharacter();
    const father = character.family.members.find((member) => member.role === 'father')!;
    const mother = character.family.members.find((member) => member.role === 'mother')!;
    const withEstate = {
      ...character,
      family: {
        ...character.family,
        members: character.family.members.map((member) => (
          member.id === father.id
            ? { ...member, estateCash: 100_000 }
            : member.id === mother.id ? { ...member, status: 'deceased' as const } : member
        )),
      },
    };

    const firstYear = processFamilyYear(withEstate, () => 0);
    expect(firstYear.character.family.members.find((member) => member.id === father.id)?.status)
      .toBe('deceased');
    expect(firstYear.character.cash).toBe(character.cash + 100_000);
    expect(firstYear.historyEntries.some((entry) => entry.includes('warisan keluarga'))).toBe(true);

    const secondYear = processFamilyYear({
      ...firstYear.character,
      currentYear: firstYear.character.currentYear + 1,
    }, () => 0);
    expect(secondYear.character.cash).toBe(firstYear.character.cash);
  });

  it('marks a deceased spouse as widowed rather than re-processing the marriage', () => {
    const character = makeMarriedCharacter();
    const oldSpouse = {
      ...spouse(),
      profile: { ...spouse().profile!, age: 100, health: 0 },
    };
    const result = processFamilyYear({
      ...character,
      relationships: [oldSpouse],
    }, () => 0);

    expect(result.character.maritalStatus).toBe('widowed');
    expect(result.character.relationships[0].profile?.lifeStatus).toBe('deceased');
    expect(result.historyEntries.some((entry) => entry.includes('meninggal dunia'))).toBe(true);
  });

  it('normalizes older relationship and child records without losing the character', () => {
    const character = makeCharacter();
    const legacy = {
      ...character,
      relationships: [{
        id: 'old-friend',
        name: 'Teman lama',
        kind: 'friend' as const,
        score: 40,
        trust: 35,
        loyalty: 30,
        status: 'active' as const,
        startedYear: 2000,
      }],
      children: [{
        id: 'old-child',
        name: 'Anak lama',
        birthYear: 2008,
        relationship: 60,
      }],
    };
    const normalized = normalizeFamilyRecords(legacy);

    expect(normalized.relationships[0].profile?.lifeStatus).toBe('alive');
    expect(normalized.relationships[0].stage).toBe('friend');
    expect(normalized.children[0].lifeStatus).toBe('alive');
    expect(normalized.children[0].trust).toBe(60);
    expect(normalized.family.members.find((member) => member.role === 'father')?.birthYear).toBe(1950);
  });

  it('fills missing parent occupations when restoring an older family save', () => {
    const character = makeCharacter();
    const legacy = {
      ...character,
      family: {
        ...character.family,
        members: character.family.members.map((member) => (
          member.role === 'father' || member.role === 'mother'
            ? { ...member, occupationId: null }
            : member
        )),
      },
    };
    const restored = normalizeFamilyRecords(legacy, () => 0);

    expect(restored.family.members.find((member) => member.role === 'father')?.occupationId)
      .toBeTruthy();
    expect(restored.family.members.find((member) => member.role === 'mother')?.occupationId)
      .toBeTruthy();
  });
});
