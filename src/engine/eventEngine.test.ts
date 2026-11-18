import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import { extendedLifeEvents } from '../data/events/extendedLifeEvents';
import { lifeEventLibrary } from '../data/events';
import { educationCareerEvents } from '../data/events/educationCareerEvents';
import { applyConsequence } from './consequenceEngine';
import {
  createEmptyEventProgress,
  getChoiceUnavailableReason,
  processPendingConsequences,
  recordEventChoice,
  selectLifeEvent,
} from './eventEngine';
import type { LifeEvent, PersonalityTrait } from '../types/game';

const character = createCharacter({
  ...initialCharacterDraft,
  firstName: 'Nara',
  lastName: 'Putri',
  gender: 'female',
  birthDate: '2000-05-21',
  familyBackground: 'modest',
  parentCondition: 'both_alive',
  personalityTraits: ['friendly'],
}, {
  today: new Date('2026-11-18T12:00:00'),
  idFactory: () => 'event-character',
});

function event(overrides: Partial<LifeEvent> = {}): LifeEvent {
  return {
    id: 'test-event',
    title: 'Peristiwa uji',
    description: 'Narasi fiksi untuk pengujian.',
    category: 'family',
    minAge: 18,
    maxAge: 22,
    minYear: 2018,
    maxYear: 2030,
    countryCode: 'ID',
    province: 'Sumatera Barat',
    city: 'Padang',
    probability: 1,
    once: true,
    fictional: true,
    statRequirements: { happiness: { min: 50 } },
    relationshipRequirements: [{ role: 'mother', min: 50 }],
    choices: [{
      id: 'accept',
      label: 'Terima',
      description: 'Pilih peristiwa.',
      consequence: { historyText: 'Memilih peristiwa uji.' },
    }],
    ...overrides,
  };
}

describe('life event engine', () => {
  it('provides at least 40 uniquely identified events across required categories', () => {
    const ids = lifeEventLibrary.map((item) => item.id);
    const categories = new Set(lifeEventLibrary.map((item) => item.category));

    expect(lifeEventLibrary.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of [
      'family', 'education', 'career', 'romance', 'friendship', 'finance',
      'health', 'crime', 'underworld', 'social', 'historical', 'random_life', 'death',
    ]) expect(categories.has(category)).toBe(true);
  });

  it('limits historical facts to their year and labels speculative future content', () => {
    const historical = extendedLifeEvents.find((item) => item.id === 'historical-reformasi')!;
    const future = extendedLifeEvents.find((item) => item.id === 'future-community-network')!;

    expect(historical.historicalClassification).toBe('historical_fact');
    expect(selectLifeEvent(
      { ...character, age: 18, currentYear: 1998 },
      createEmptyEventProgress(),
      () => 0,
      [historical],
    )?.id).toBe(historical.id);
    expect(selectLifeEvent(
      { ...character, age: 18, currentYear: 1999 },
      createEmptyEventProgress(),
      () => 0,
      [historical],
    )).toBeNull();
    expect(future.historicalClassification).toBe('alternate_future');
    expect(selectLifeEvent(
      { ...character, age: 18, currentYear: 2026 },
      createEmptyEventProgress(),
      () => 0,
      [future],
    )).toBeNull();
  });

  it('checks age, year, location, stats, and family relationship requirements', () => {
    const adult = { ...character, age: 20, currentYear: 2020 };
    const progress = createEmptyEventProgress();
    const validEvent = event();

    expect(selectLifeEvent(adult, progress, () => 0, [validEvent])?.id).toBe('test-event');
    expect(selectLifeEvent(adult, progress, () => 0, [event({ minYear: 2021 })])).toBeNull();
    expect(selectLifeEvent(adult, progress, () => 0, [event({ countryCode: 'US' })])).toBeNull();
    expect(selectLifeEvent(adult, progress, () => 0, [event({ statRequirements: { health: { min: 101 } } })])).toBeNull();
    expect(selectLifeEvent(adult, progress, () => 0, [event({ relationshipRequirements: [{ role: 'mother', min: 100 }] })])).toBeNull();
  });

  it('prevents one-time repeats and respects cooldowns', () => {
    const adult = { ...character, age: 20, currentYear: 2020 };
    const oneTime = event();
    const completed = {
      ...createEmptyEventProgress(),
      completedEventIds: ['test-event'],
    };
    expect(selectLifeEvent(adult, completed, () => 0, [oneTime])).toBeNull();

    const repeatable = event({ once: false, cooldownYears: 5 });
    const onCooldown = {
      ...createEmptyEventProgress(),
      lastEventYears: { 'test-event': 2018 },
    };
    expect(selectLifeEvent(adult, onCooldown, () => 0, [repeatable])).toBeNull();
    expect(selectLifeEvent(
      { ...adult, currentYear: 2023 },
      onCooldown,
      () => 0,
      [repeatable],
    )?.id).toBe('test-event');
  });

  it('records the chosen event and updates its repeat guard', () => {
    const testEvent = event();
    const progress = recordEventChoice(createEmptyEventProgress(), testEvent, 'accept', 2020, 20);

    expect(progress.completedEventIds).toEqual(['test-event']);
    expect(progress.lastEventYears).toEqual({ 'test-event': 2020 });
    expect(progress.history).toEqual([{
      eventId: 'test-event',
      title: 'Peristiwa uji',
      category: 'family',
      year: 2020,
      age: 20,
      choiceId: 'accept',
      choiceLabel: 'Terima',
      outcomeText: 'Memilih peristiwa uji.',
    }]);
  });

  it('unlocks dependent events only after their prerequisite is completed', () => {
    const dependent = event({ requiresCompletedEventIds: ['earlier-choice'] });
    const adult = { ...character, age: 20, currentYear: 2020 };

    expect(selectLifeEvent(adult, createEmptyEventProgress(), () => 0, [dependent])).toBeNull();
    expect(selectLifeEvent(adult, {
      ...createEmptyEventProgress(),
      completedEventIds: ['earlier-choice'],
    }, () => 0, [dependent])?.id).toBe('test-event');
  });

  it('uses event probability while applying personality affinity', () => {
    const friendly = { ...character, age: 20, currentYear: 2020 };
    const shy = {
      ...friendly,
      personality: { traits: ['shy' as PersonalityTrait] },
    };
    const socialEvent = event({ probability: 0.4 });

    expect(selectLifeEvent(friendly, createEmptyEventProgress(), () => 0.43, [socialEvent])?.id)
      .toBe('test-event');
    expect(selectLifeEvent(shy, createEmptyEventProgress(), () => 0.43, [socialEvent]))
      .toBeNull();
    expect(selectLifeEvent(friendly, createEmptyEventProgress(), () => 0, [
      event({ probability: 0 }),
    ])).toBeNull();
  });

  it('gates academic recognition and promotion on real education and career records', () => {
    const honorary = educationCareerEvents.find(
      (item) => item.id === 'education-research-recognition',
    )!;
    const doctorate = {
      ...character,
      age: 40,
      currentYear: 2040,
      stats: { ...character.stats, reputation: 80 },
      educationRecord: {
        ...character.educationRecord,
        currentLevel: 's3' as const,
        status: 'completed' as const,
        completedLevels: ['s3' as const],
      },
    };
    expect(selectLifeEvent(doctorate, createEmptyEventProgress(), () => 0, [honorary])?.id)
      .toBe(honorary.id);
    expect(selectLifeEvent(character, createEmptyEventProgress(), () => 0, [honorary])).toBeNull();
    const recognized = applyConsequence(doctorate, honorary.choices[0].consequence);
    expect(recognized.educationRecord.honoraryDegrees).toHaveLength(1);
    expect(applyConsequence(recognized, honorary.choices[0].consequence)
      .educationRecord.honoraryDegrees).toHaveLength(1);

    const promotion = educationCareerEvents.find(
      (item) => item.id === 'career-promotion-review',
    )!;
    const employed = {
      ...character,
      age: 32,
      currentYear: 2032,
      careerRecord: {
        ...character.careerRecord,
        status: 'employed' as const,
        currentOccupationId: 'entry-worker',
        experienceYears: 2,
        monthlySalary: 5_000_000,
        promotionCooldownUntil: 2020,
      },
    };
    expect(selectLifeEvent(employed, createEmptyEventProgress(), () => 0, [promotion])?.id)
      .toBe(promotion.id);
    expect(selectLifeEvent(character, createEmptyEventProgress(), () => 0, [promotion])).toBeNull();
  });

  it('checks asset, organization, education, and debt requirements for choices', () => {
    const adult = { ...character, age: 24, currentYear: 2024 };
    const choice = event().choices[0];
    expect(getChoiceUnavailableReason(adult, {
      ...choice,
      requirements: { minAssetValue: Number.MAX_SAFE_INTEGER },
    })).toContain('Aset');
    expect(getChoiceUnavailableReason(adult, {
      ...choice,
      requirements: { requiredOrganizationIds: ['community-reading-room'] },
    })).toContain('organisasi');
    expect(getChoiceUnavailableReason(adult, {
      ...choice,
      requirements: { requiredEducation: ['Gelar universitas'] },
    })).toContain('Pendidikan');
    expect(getChoiceUnavailableReason(adult, {
      ...choice,
      requirements: { maxDebt: 0 },
    })).toBeNull();
  });

  it('schedules and applies a delayed consequence exactly once', () => {
    const delayedEvent = event({
      choices: [{
        id: 'accept',
        label: 'Terima',
        description: 'Pilih peristiwa.',
        consequence: {
          historyText: 'Memulai rencana.',
          delayedConsequences: [{
            id: 'later-result',
            delayYears: 2,
            expiresAfterYears: 1,
            historyText: 'Rencana mulai membuahkan hasil.',
            consequence: { cashChange: 500, historyText: 'Menerima hasil simpanan.' },
            followUpEventIds: ['follow-up'],
          }],
        },
      }],
    });
    const progress = recordEventChoice(createEmptyEventProgress(), delayedEvent, 'accept', 2020, 20);
    expect(progress.pendingConsequences[0].dueYear).toBe(2022);

    const notDue = processPendingConsequences({ ...character, currentYear: 2021 }, progress);
    expect(notDue.eventProgress.pendingConsequences).toHaveLength(1);
    expect(notDue.character.cash).toBe(character.cash);

    const due = processPendingConsequences({ ...character, currentYear: 2022 }, progress);
    expect(due.character.cash).toBe(character.cash + 500);
    expect(due.eventProgress.pendingConsequences).toHaveLength(0);
    expect(due.eventProgress.processedConsequenceIds).toContain(progress.pendingConsequences[0].id);
    expect(due.eventProgress.pendingEventIds).toContain('follow-up');

    const processedAgain = processPendingConsequences(due.character, due.eventProgress);
    expect(processedAgain.character.cash).toBe(due.character.cash);
  });

  it('waits for a delayed trigger and expires it without applying it', () => {
    const scheduled = {
      id: 'triggered-result',
      sourceEventId: 'source',
      sourceChoiceId: 'choice',
      dueYear: 2021,
      expiresYear: 2022,
      delayYears: 1,
      expiresAfterYears: 1,
      historyText: 'Hasil tertunda.',
      trigger: { requiredOrganizationIds: ['community-reading-room'] },
      consequence: { cashChange: 500, historyText: 'Menerima hasil.' },
    };
    const progress = {
      ...createEmptyEventProgress(),
      pendingConsequences: [scheduled],
    };
    const dueCharacter = { ...character, currentYear: 2021 };

    const stillWaiting = processPendingConsequences(dueCharacter, progress);
    expect(stillWaiting.character.cash).toBe(character.cash);
    expect(stillWaiting.eventProgress.pendingConsequences).toHaveLength(1);

    const expired = processPendingConsequences(
      { ...dueCharacter, currentYear: 2023 },
      stillWaiting.eventProgress,
    );
    expect(expired.character.cash).toBe(character.cash);
    expect(expired.eventProgress.pendingConsequences).toHaveLength(0);
    expect(expired.eventProgress.processedConsequenceIds).toContain('triggered-result');
  });

  it('unlocks the fictional organization event chain only after joining', () => {
    const adult = { ...character, age: 26, currentYear: 2026 };
    const intro = extendedLifeEvents.find((item) => item.id === 'underworld-introduction')!;
    const loyalty = extendedLifeEvents.find((item) => item.id === 'underworld-loyalty-test')!;
    const empty = createEmptyEventProgress();
    expect(selectLifeEvent(adult, empty, () => 0, [loyalty])).toBeNull();

    const joinChoice = intro.choices.find((item) => item.id === 'join-fictional-group')!;
    const member = applyConsequence(adult, joinChoice.consequence);
    const progress = recordEventChoice(empty, intro, joinChoice.id, adult.currentYear, adult.age);
    expect(member.organizations[0].joinedYear).toBe(adult.currentYear);
    expect(selectLifeEvent(member, progress, () => 0, [loyalty])?.id).toBe(loyalty.id);
  });
});
