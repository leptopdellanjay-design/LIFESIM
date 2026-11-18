import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from '../engine/characterCreation';
import { gameDatabase } from '../persistence/gameDatabase';
import { useGameStore } from './gameStore';

const character = createCharacter({
  ...initialCharacterDraft,
  firstName: 'Dewi',
  lastName: 'Sari',
  gender: 'female',
  birthDate: '2000-09-12',
  familyBackground: 'middle',
  parentCondition: 'mother_only',
  personalityTraits: ['ambitious'],
}, {
  today: new Date('2026-11-18T12:00:00'),
  idFactory: () => 'persisted-life',
});

describe('game store with IndexedDB', () => {
  beforeEach(async () => {
    await gameDatabase.saves.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    await useGameStore.getState().hydrate();
  });

  it('starts, advances, and restores the same life from IndexedDB', async () => {
    expect(await useGameStore.getState().startLife(character)).toBe(true);
    useGameStore.setState({
      eventProgress: {
        completedEventIds: ['childhood-hobby'],
        lastEventYears: { 'childhood-hobby': 2000 },
        history: [{
          eventId: 'childhood-hobby',
          title: 'Menemukan kegiatan yang disukai',
          category: 'random_life',
          year: 2000,
          age: 0,
          choiceId: 'practice-hobby',
          choiceLabel: 'Berlatih secara rutin',
          outcomeText: 'Berlatih kegiatan yang disukai secara rutin.',
        }],
        pendingEventIds: [],
        pendingConsequences: [],
        processedConsequenceIds: [],
      },
    });
    expect(await useGameStore.getState().advanceYear(() => 0.99)).toBe(true);

    useGameStore.setState(useGameStore.getInitialState(), true);
    await useGameStore.getState().hydrate();

    const restored = useGameStore.getState();
    expect(restored.character?.id).toBe('persisted-life');
    expect(restored.character?.age).toBe(1);
    expect(restored.character?.currentYear).toBe(2001);
    expect(restored.history.some((entry) => entry.startsWith('2001: Bertambah usia menjadi 1 tahun'))).toBe(true);
    expect(restored.history[0]).toContain('ini menjadi catatan awal perjalanan');
    expect(restored.eventProgress.completedEventIds).toEqual(['childhood-hobby']);
    expect(restored.eventProgress.lastEventYears['childhood-hobby']).toBe(2000);
    expect(restored.eventProgress.history[0].choiceId).toBe('practice-hobby');
    expect(restored.persistenceStatus).toBe('saved');
  });
});
