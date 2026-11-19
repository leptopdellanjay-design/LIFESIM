import { describe, expect, it } from 'vitest';
import type { Character, ChildRecord } from '../types/game';
import { createChild } from './familyEngine';
import {
  createSuccessorCharacter,
  getEligibleSuccessors,
  setEstatePlan,
  settleEstateOnDeath,
} from './successionEngine';
import { createCharacter, initialCharacterDraft } from './characterCreation';

function makeParent(): Character {
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
    idFactory: () => 'parent-character',
  });
  return {
    ...character,
    age: 50,
    currentYear: 2030,
    cash: 1_000_000,
    debt: 200_000,
    assets: [{
      id: 'home',
      name: 'Rumah keluarga',
      category: 'home',
      value: 3_000_000,
    }],
    startingAssets: { ...character.startingAssets, nonCashValue: 1_200_000 },
    maritalStatus: 'married',
    relationships: [{
      id: 'second-parent',
      name: 'Dara',
      kind: 'spouse',
      score: 80,
      trust: 75,
      loyalty: 75,
      status: 'active',
      stage: 'married',
      startedYear: 2005,
      profile: {
        age: 48,
        gender: 'male',
        personality: { traits: [] },
        occupationId: null,
        educationLevel: 'sma',
        netWorth: 0,
        health: 80,
        lifeStatus: 'alive',
      },
    }],
  };
}

function adultChildren(parent: Character): Character {
  const first = createChild(parent, 'Bima Putra')!.character;
  const second = createChild(first, 'Ayu Putri')!.character;
  return {
    ...second,
    children: second.children.map((child) => ({ ...child, birthYear: 2010 })),
    currentYear: 2030,
    status: 'deceased',
    deathRecord: {
      age: 50,
      year: 2030,
      cause: 'Penyebab alami dalam simulasi',
    },
  };
}

describe('succession and estate rules', () => {
  it('settles debts first and distributes the remaining estate among spouse and children', () => {
    const deceased = adultChildren(makeParent());
    const result = settleEstateOnDeath(deceased);
    const settlement = result.character.estateSettlement!;

    expect(settlement).toMatchObject({
      grossValue: 5_200_000,
      debtsPaid: 200_000,
      unpaidDebt: 0,
      netValue: 5_000_000,
      distribution: 'equal_heirs',
    });
    expect(settlement.shares.map((share) => share.amount)).toEqual([1_666_667, 1_666_667, 1_666_666]);
    expect(result.character.children.every((child) => child.inheritanceCash! > 0)).toBe(true);
    expect(settleEstateOnDeath(result.character).historyEntries).toEqual([]);
  });

  it('supports spouse-priority and named-heir plans with validated living heirs', () => {
    const deceased = adultChildren(makeParent());
    const namedHeir = deceased.children[0];
    const namedPlan = setEstatePlan(deceased, 'named_heir', namedHeir.id);
    expect(namedPlan).toBeNull();

    const living = { ...deceased, status: 'alive' as const };
    const updatedPlan = setEstatePlan(living, 'named_heir', namedHeir.id)!;
    const settlement = settleEstateOnDeath({
      ...updatedPlan.character,
      status: 'deceased',
      deathRecord: deceased.deathRecord,
    }).character.estateSettlement!;
    expect(settlement.shares.find((share) => share.beneficiaryId === namedHeir.id)?.amount)
      .toBe(Math.floor(settlement.netValue * 0.6));

    const spousePriority = setEstatePlan(living, 'spouse_priority')!;
    const spouseSettlement = settleEstateOnDeath({
      ...spousePriority.character,
      status: 'deceased',
      deathRecord: deceased.deathRecord,
    }).character.estateSettlement!;
    expect(spouseSettlement.shares.find((share) => share.beneficiaryType === 'spouse')?.amount)
      .toBe(Math.floor(spouseSettlement.netValue / 2));
  });

  it('falls back to equal distribution if the named heir is no longer living', () => {
    const parent = adultChildren(makeParent());
    const plan = setEstatePlan({ ...parent, status: 'alive' }, 'named_heir', parent.children[0].id)!;
    const deceased = {
      ...plan.character,
      status: 'deceased' as const,
      deathRecord: parent.deathRecord,
      children: plan.character.children.map((child) => (
        child.id === parent.children[0].id ? { ...child, lifeStatus: 'deceased' as const } : child
      )),
    };

    expect(settleEstateOnDeath(deceased).character.estateSettlement?.distribution).toBe('equal_heirs');
  });

  it('continues the story as an adult heir and records lineage and sibling relationships', () => {
    const deceased = settleEstateOnDeath(adultChildren(makeParent())).character;
    const heir = deceased.children[0];
    const result = createSuccessorCharacter(deceased, heir.id)!;

    expect(getEligibleSuccessors(deceased).map((child) => child.id)).toContain(heir.id);
    expect(result.character).toMatchObject({
      generation: 1,
      age: 20,
      currentYear: 2030,
      status: 'alive',
      cash: heir.inheritanceCash,
      ancestors: [{ id: 'parent-character', generation: 0 }],
      identity: { firstName: 'Bima', lastName: 'Putra' },
      estateSettlement: null,
    });
    expect(result.character.family.members.some((member) => member.role === 'sibling' && member.name === 'Ayu Putri')).toBe(true);
    expect(result.historyText).toContain('generasi 2');

    const marriedSuccessor: Character = {
      ...result.character,
      maritalStatus: 'married',
      relationships: [{
        id: 'successor-partner',
        name: 'Sari',
        kind: 'spouse',
        score: 75,
        trust: 70,
        loyalty: 70,
        status: 'active',
        stage: 'married',
        startedYear: 2028,
        profile: {
          age: 24,
          gender: 'female',
          personality: { traits: [] },
          occupationId: null,
          educationLevel: 'sma',
          netWorth: 0,
          health: 80,
          lifeStatus: 'alive',
        },
      }],
    };
    expect(createChild(marriedSuccessor, 'Cucu Raka')?.character.children[0].generation).toBe(2);
  });

  it('does not allow a minor or deceased child to continue the life', () => {
    const deceased = adultChildren(makeParent());
    const minor: ChildRecord = {
      ...deceased.children[0],
      id: 'minor-heir',
      birthYear: 2020,
    };
    const withMinor = settleEstateOnDeath({
      ...deceased,
      estateSettlement: null,
      children: [minor],
    }).character;

    expect(createSuccessorCharacter(withMinor, minor.id)).toBeNull();
    expect(getEligibleSuccessors(withMinor)).toEqual([]);
  });
});
