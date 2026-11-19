import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from '../engine/characterCreation';
import { gameDatabase } from '../persistence/gameDatabase';
import { exportGameBackup } from '../persistence/gameSave';
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
    await gameDatabase.settings.clear();
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
    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(true);

    useGameStore.setState(useGameStore.getInitialState(), true);
    await useGameStore.getState().hydrate();

    const restored = useGameStore.getState();
    expect(restored.character?.id).toBe('persisted-life');
    expect(restored.character?.age).toBe(0);
    expect(restored.character?.currentYear).toBe(2000);
    expect(restored.character?.currentMonth).toBe(10);
    expect(restored.history[0]).toContain('ini menjadi catatan awal perjalanan');
    expect(restored.eventProgress.completedEventIds).toEqual(['childhood-hobby']);
    expect(restored.eventProgress.lastEventYears['childhood-hobby']).toBe(2000);
    expect(restored.eventProgress.history[0].choiceId).toBe('practice-hobby');
    expect(restored.persistenceStatus).toBe('saved');
  });

  it('persists smartphone purchases through the canonical store and IndexedDB', async () => {
    const cash = 500_000_000;
    const adultCharacter = {
      ...character,
      age: 30,
      currentYear: 2026,
      cash,
      netWorth: cash + character.startingAssets.nonCashValue,
    };
    expect(await useGameStore.getState().startLife(adultCharacter)).toBe(true);

    expect(await useGameStore.getState().buySmartphone('garuda-ultra')).toBe(true);

    const saved = await gameDatabase.saves.get('active');
    expect(saved?.character.digitalLife.smartphone?.modelId).toBe('garuda-ultra');
    expect(saved?.character.assets[0].category).toBe('device');
    expect(useGameStore.getState().character?.cash).toBeLessThan(cash);
  });

  it('creates a separate life slot and reloads the selected slot', async () => {
    const store = useGameStore.getState();
    expect(await store.startLife(character)).toBe(true);
    const firstSlotId = useGameStore.getState().selectedSaveSlotId;

    expect(await useGameStore.getState().createNewSaveSlot()).toBe(true);
    const secondSlotId = useGameStore.getState().selectedSaveSlotId;
    expect(secondSlotId).not.toBe(firstSlotId);
    expect(useGameStore.getState().character).toBeNull();

    const secondCharacter = { ...character, id: 'second-life' };
    expect(await useGameStore.getState().startLife(secondCharacter)).toBe(true);
    expect(useGameStore.getState().saveSlots).toHaveLength(2);
    expect(await useGameStore.getState().selectSaveSlot(firstSlotId)).toBe(true);
    expect(useGameStore.getState().character?.id).toBe('persisted-life');

    useGameStore.setState(useGameStore.getInitialState(), true);
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().selectedSaveSlotId).toBe(firstSlotId);
    expect(useGameStore.getState().character?.id).toBe('persisted-life');
  });

  it('restores a backup into the currently selected slot', async () => {
    expect(await useGameStore.getState().startLife(character)).toBe(true);
    const backup = await exportGameBackup(useGameStore.getState().selectedSaveSlotId);
    expect(await useGameStore.getState().createNewSaveSlot()).toBe(true);
    const targetSlotId = useGameStore.getState().selectedSaveSlotId;

    expect(await useGameStore.getState().importGameBackup(backup)).toBe(true);
    expect(useGameStore.getState().selectedSaveSlotId).toBe(targetSlotId);
    expect(useGameStore.getState().character?.id).toBe('persisted-life');
    expect(useGameStore.getState().saveSlots).toHaveLength(2);
  });

  it('saves a playable successor into the same slot after the previous character dies', async () => {
    const eventProgress = useGameStore.getState().eventProgress;
    const deceased = {
      ...character,
      generation: 0,
      currentYear: 2026,
      age: 50,
      status: 'deceased' as const,
      deathRecord: { age: 50, year: 2026, cause: 'Penyebab alami dalam simulasi' },
      children: [{
        id: 'adult-heir',
        name: 'Raka Utama',
        birthYear: 2000,
        gender: 'male' as const,
        relationship: 70,
        health: 80,
        happiness: 70,
        intelligence: 65,
        educationLevel: 'sma' as const,
        lifeStatus: 'alive' as const,
        generation: 1,
        inheritanceCash: 750_000,
      }],
      estateSettlement: {
        year: 2026,
        grossValue: 750_000,
        debtsPaid: 0,
        unpaidDebt: 0,
        netValue: 750_000,
        distribution: 'equal_heirs' as const,
        shares: [{
          beneficiaryId: 'adult-heir',
          beneficiaryName: 'Raka Utama',
          beneficiaryType: 'child' as const,
          amount: 750_000,
        }],
      },
    };
    const history = ['2026: Kehidupan berakhir.'];
    await gameDatabase.saves.put({
      id: 'active',
      version: 6,
      character: deceased,
      history,
      activeEvent: null,
      eventProgress,
      updatedAt: Date.now(),
    });
    useGameStore.setState({
      character: deceased,
      history,
      activeEvent: null,
      eventProgress,
      persistenceStatus: 'saved',
      selectedSaveSlotId: 'active',
    });

    expect(await useGameStore.getState().continueAsHeir('adult-heir')).toBe(true);
    expect(useGameStore.getState().character).toMatchObject({
      id: 'life-adult-heir-generation-1',
      identity: { firstName: 'Raka', lastName: 'Utama' },
      generation: 1,
      age: 26,
      cash: 750_000,
      status: 'alive',
    });
    expect((await gameDatabase.saves.get('active'))?.character.identity.firstName).toBe('Raka');
  });
});
