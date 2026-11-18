import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  askToDate,
  divorcePartner,
  interactWithFamilyMember,
  interactWithRelationship,
  marryPartner,
  meetNewPerson,
  proposeEngagement,
} from './relationshipEngine';

function makeAdultCharacter() {
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
    idFactory: () => 'relationship-character',
  });
  const cash = 5_000_000;
  return {
    ...character,
    age: 30,
    currentYear: 2010,
    cash,
    netWorth: cash + character.startingAssets.nonCashValue - character.debt,
  };
}

describe('relationship engine', () => {
  it('creates a persistent NPC profile and rejects unaffordable interactions', () => {
    const character = makeAdultCharacter();
    const result = meetNewPerson(character, () => 0.1);
    expect(result).not.toBeNull();
    expect(result?.character.relationships).toHaveLength(1);
    expect(result?.character.relationships[0]).toMatchObject({
      kind: 'friend',
      stage: 'friend',
      profile: { lifeStatus: 'alive', age: 27 },
    });

    const withoutCash = { ...result!.character, cash: 0 };
    expect(interactWithRelationship(withoutCash, result!.character.relationships[0].id, 'gift')).toBeNull();
  });

  it('applies social interactions and progresses dating, engagement, and marriage', () => {
    const met = meetNewPerson(makeAdultCharacter(), () => 0.1)!;
    const id = met.character.relationships[0].id;
    const dating = askToDate(met.character, id, () => 0.1)!;
    expect(dating.character.maritalStatus).toBe('partnered');
    expect(dating.character.relationships[0].stage).toBe('dating');

    let prepared = dating.character;
    for (let index = 0; index < 5; index += 1) {
      prepared = interactWithRelationship(prepared, id, 'talk')!.character;
    }
    const engaged = proposeEngagement(prepared, id, () => 0.1)!;
    expect(engaged.character.maritalStatus).toBe('engaged');
    expect(engaged.character.relationships[0].stage).toBe('engaged');

    const married = marryPartner(engaged.character, id, 'simple')!;
    expect(married.character.maritalStatus).toBe('married');
    expect(married.character.spouseName).toBe(engaged.character.relationships[0].name);
    expect(married.character.relationships[0].kind).toBe('spouse');
    expect(married.character.cash).toBeLessThan(engaged.character.cash);
  });

  it('records a bounded settlement and ended marriage after divorce', () => {
    const met = meetNewPerson(makeAdultCharacter(), () => 0.1)!;
    const id = met.character.relationships[0].id;
    let character = askToDate(met.character, id, () => 0.1)!.character;
    for (let index = 0; index < 5; index += 1) {
      character = interactWithRelationship(character, id, 'talk')!.character;
    }
    character = proposeEngagement(character, id, () => 0.1)!.character;
    character = marryPartner(character, id, 'simple')!.character;

    const result = divorcePartner(character)!;
    expect(result.character.maritalStatus).toBe('separated');
    expect(result.character.spouseName).toBeNull();
    expect(result.character.relationships[0].stage).toBe('separated');
    expect(result.character.cash).toBeLessThan(character.cash);
    expect(result.historyText).toContain('penyelesaian aset');
  });

  it('changes family ties through real interaction records', () => {
    const character = makeAdultCharacter();
    const father = character.family.members.find((member) => member.role === 'father')!;
    const result = interactWithFamilyMember(character, father.id, 'talk')!;

    expect(result.character.family.members.find((member) => member.id === father.id)?.relationship)
      .toBe(father.relationship + 3);
    expect(result.character.stats.happiness).toBe(character.stats.happiness + 1);
  });
});
