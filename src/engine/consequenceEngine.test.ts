import { describe, expect, it } from 'vitest';
import { applyConsequence } from './consequenceEngine';
import { createCharacter } from './characterCreation';
import type { CharacterDraft } from '../types/game';

const draft: CharacterDraft = {
  firstName: 'Test',
  lastName: 'Character',
  gender: 'other',
  birthDate: '2009-01-01',
  avatarId: 'leaf',
  countryCode: 'ID',
  province: 'Sumatera Barat',
  city: 'Padang',
  familyBackground: 'modest',
  parentCondition: 'both_alive',
  siblingCount: 0,
  personalityTraits: ['friendly'],
};

const character = createCharacter(draft, {
  today: new Date('2026-11-18T12:00:00'),
  idFactory: () => 'test-character',
});

describe('applyConsequence', () => {
  it('applies stat and cash changes without conflating wealth and net worth', () => {
    const result = applyConsequence(character, {
      statChanges: { intelligence: 5, energy: -3 },
      cashChange: 25000,
      historyText: 'Mencoba beasiswa',
    });
    expect(result.stats.intelligence).toBe(character.stats.intelligence + 5);
    expect(result.stats.energy).toBe(character.stats.energy - 3);
    expect(result.cash).toBe(character.cash + 25000);
    expect(result.netWorth).toBe(character.netWorth + 25000);
    expect(result.stats.wealth).toBe(character.stats.wealth);
  });

  it('clamps stats between 0 and 100', () => {
    const result = applyConsequence(character, {
      statChanges: { health: 50 },
      historyText: 'Tes',
    });
    expect(result.stats.health).toBe(100);
  });

  it('does not allow cash or net worth to fall below zero', () => {
    const result = applyConsequence(character, {
      cashChange: -Number.MAX_SAFE_INTEGER,
      historyText: 'Pengeluaran',
    });
    expect(result.cash).toBe(0);
    expect(result.netWorth).toBeGreaterThanOrEqual(0);
  });

  it('updates only living family relationships and keeps them within bounds', () => {
    const result = applyConsequence(character, {
      relationshipChanges: [
        { role: 'living_family', amount: 5 },
        { role: 'father', amount: -10 },
      ],
      historyText: 'Menghabiskan waktu bersama keluarga',
    });

    expect(result.family.members.find((member) => member.role === 'father')?.relationship).toBe(60);
    expect(result.family.members.find((member) => member.role === 'mother')?.relationship).toBe(70);
  });

  it('updates debt, assets, social trust, and legal status with valid bounds', () => {
    const result = applyConsequence(character, {
      debtChange: 250000,
      assetChanges: [{
        action: 'add',
        asset: { id: 'bike', name: 'Sepeda', category: 'vehicle', value: 500000 },
      }],
      relationshipsAdded: [{
        id: 'friend',
        name: 'Teman',
        kind: 'friend',
        score: 60,
        trust: 55,
        loyalty: 50,
        status: 'active',
        startedYear: 0,
      }],
      relationshipEffects: [{
        target: { type: 'social', id: 'friend' },
        scoreChange: 10,
        trustChange: 15,
        loyaltyChange: -10,
      }],
      legalStatus: 'under_investigation',
      historyText: 'Perubahan sosial dan keuangan.',
    });

    expect(result.debt).toBe(250000);
    expect(result.assets.find((asset) => asset.id === 'bike')?.value).toBe(500000);
    expect(result.netWorth).toBeGreaterThanOrEqual(0);
    expect(result.relationships[0]).toMatchObject({
      score: 70,
      trust: 70,
      loyalty: 40,
      startedYear: character.currentYear,
    });
    expect(result.legalStatus).toBe('under_investigation');
  });

  it('updates romantic stages and applies relationship effects to a child', () => {
    const adult = {
      ...character,
      age: 30,
      maritalStatus: 'partnered' as const,
      relationships: [{
        id: 'partner',
        name: 'Pasangan',
        kind: 'romantic_partner' as const,
        score: 60,
        trust: 55,
        loyalty: 50,
        status: 'active' as const,
        startedYear: character.currentYear,
        stage: 'dating' as const,
      }],
      children: [{
        id: 'child',
        name: 'Anak',
        birthYear: character.currentYear,
        relationship: 60,
      }],
    };
    const result = applyConsequence(adult, {
      maritalStatus: 'engaged',
      relationshipEffects: [
        { target: { type: 'social', id: 'partner' }, trustChange: 5 },
        { target: { type: 'child', id: 'child' }, scoreChange: 5, trustChange: 8 },
      ],
      historyText: 'Perkembangan hubungan.',
    });

    expect(result.relationships[0].stage).toBe('engaged');
    expect(result.maritalStatus).toBe('engaged');
    expect(result.children[0].relationship).toBe(65);
    expect(result.children[0].trust).toBe(68);
  });

  it('resolves event relationship aliases to the active partner and friend', () => {
    const adult = {
      ...character,
      age: 30,
      maritalStatus: 'partnered' as const,
      relationships: [
        {
          id: 'acquaintance-partner',
          name: 'Pasangan',
          kind: 'romantic_partner' as const,
          score: 60,
          trust: 55,
          loyalty: 50,
          status: 'active' as const,
          stage: 'dating' as const,
          startedYear: character.currentYear,
        },
        {
          id: 'acquaintance-friend',
          name: 'Teman',
          kind: 'friend' as const,
          score: 45,
          trust: 40,
          loyalty: 35,
          status: 'active' as const,
          stage: 'friend' as const,
          startedYear: character.currentYear,
        },
      ],
    };
    const result = applyConsequence(adult, {
      relationshipEffects: [
        { target: { type: 'social', id: 'partner' }, trustChange: 5 },
        { target: { type: 'social', id: 'school-friend' }, scoreChange: 6 },
      ],
      historyText: 'Pilihan hubungan.',
    });

    expect(result.relationships.find((item) => item.id === 'acquaintance-partner')?.trust).toBe(60);
    expect(result.relationships.find((item) => item.id === 'acquaintance-friend')?.score).toBe(51);
  });
});
