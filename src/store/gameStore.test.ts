import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCharacter } from '../engine/characterCreation';
import { scholarshipEvent } from '../data/events/scholarship';
import { createEducationRecordFromLegacy } from '../engine/educationEngine';
import type { CharacterDraft } from '../types/game';
import type { PersistedGame } from '../persistence/gameDatabase';
import {
  createActiveGameIfAbsent,
  getPreferredSaveSlotId,
  listSavedGames,
  loadActiveGame,
  saveActiveGame,
} from '../persistence/gameSave';
import { useGameStore } from './gameStore';

vi.mock('../persistence/gameSave', () => ({
  DEFAULT_SAVE_SLOT_ID: 'active',
  createActiveGameIfAbsent: vi.fn(),
  getPreferredSaveSlotId: vi.fn(),
  importGameBackup: vi.fn(),
  listSavedGames: vi.fn(),
  loadActiveGame: vi.fn(),
  saveActiveGame: vi.fn(),
  setPreferredSaveSlotId: vi.fn(),
}));

const draft: CharacterDraft = {
  firstName: 'Nara',
  lastName: 'Putri',
  gender: 'female',
  birthDate: '2000-05-21',
  avatarId: 'leaf',
  countryCode: 'ID',
  province: 'Sumatera Barat',
  city: 'Padang',
  familyBackground: 'modest',
  parentCondition: 'both_alive',
  siblingCount: 0,
  personalityTraits: ['disciplined'],
};

const newCharacter = () => createCharacter(draft, {
  today: new Date('2026-11-18T12:00:00'),
  idFactory: () => 'store-character',
});

function persistedGame(character = newCharacter()): PersistedGame {
  return {
    id: 'active',
    version: 3,
    character,
    history: [`${character.currentYear}: Lahir di Padang, Sumatera Barat.`],
    activeEvent: null,
    eventProgress: {
      completedEventIds: [],
      lastEventYears: {},
      history: [],
      pendingEventIds: [],
      pendingConsequences: [],
      processedConsequenceIds: [],
    },
    updatedAt: 1,
  };
}

describe('game progression and persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreferredSaveSlotId).mockResolvedValue('active');
    vi.mocked(listSavedGames).mockResolvedValue([]);
    vi.mocked(loadActiveGame).mockResolvedValue(undefined);
    vi.mocked(createActiveGameIfAbsent).mockResolvedValue(true);
    vi.mocked(saveActiveGame).mockResolvedValue();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('starts a new life and persists the generated character and birth history', async () => {
    await useGameStore.getState().hydrate();

    const started = await useGameStore.getState().startLife(newCharacter());

    expect(started).toBe(true);
    expect(useGameStore.getState().character?.currentYear).toBe(2000);
    expect(useGameStore.getState().character?.age).toBe(0);
    expect(useGameStore.getState().history).toEqual([
      '2000: Lahir di Padang, Sumatera Barat; ini menjadi catatan awal perjalanan.',
    ]);
    expect(createActiveGameIfAbsent).toHaveBeenCalledOnce();
    expect(useGameStore.getState().persistenceStatus).toBe('saved');
  });

  it('loads a previously saved life without replacing it', async () => {
    const existing = persistedGame();
    vi.mocked(loadActiveGame).mockResolvedValue(existing);
    await useGameStore.getState().hydrate();

    expect(useGameStore.getState().character?.id).toBe('store-character');
    expect(useGameStore.getState().history).toEqual(existing.history);
    expect(useGameStore.getState().persistenceStatus).toBe('saved');
    expect(await useGameStore.getState().startLife(newCharacter())).toBe(false);
    expect(createActiveGameIfAbsent).not.toHaveBeenCalled();
  });

  it('restores a save created before the birth-event field was added', async () => {
    const legacy = persistedGame();
    legacy.character.stats.happiness = 65;
    delete (legacy.character as Partial<typeof legacy.character>).birthEvent;
    vi.mocked(loadActiveGame).mockResolvedValue(legacy);

    await useGameStore.getState().hydrate();

    expect(useGameStore.getState().character?.birthEvent.title).toBe('Hari kelahiran');
    expect(useGameStore.getState().character?.birthEvent.statChanges).toEqual({});
    expect(useGameStore.getState().character?.stats.happiness).toBe(65);
  });

  it('restores readable labels for event history from older saves', async () => {
    const legacy = persistedGame();
    legacy.eventProgress.history = [{
      eventId: 'family-care-early-years',
      title: 'Waktu bersama pengasuh',
      category: 'random_life',
      year: 2000,
      age: 0,
      choiceId: 'quiet-play',
      choiceLabel: 'quiet-play',
      outcomeText: 'Pilihan disimpan dari versi sebelumnya.',
    }];
    vi.mocked(loadActiveGame).mockResolvedValue(legacy);

    await useGameStore.getState().hydrate();

    expect(useGameStore.getState().eventProgress.history[0].category).toBe('family');
    expect(useGameStore.getState().eventProgress.history[0].choiceLabel).toBe('Bermain dengan tenang');
    expect(useGameStore.getState().eventProgress.history[0].outcomeText)
      .toBe('Rincian hasil pilihan tidak tersedia pada versi sebelumnya.');
  });

  it('hydrates a save if another session created it before this one', async () => {
    const existing = persistedGame();
    vi.mocked(createActiveGameIfAbsent).mockResolvedValue(false);
    vi.mocked(loadActiveGame).mockResolvedValue(existing);
    await useGameStore.getState().hydrate();

    expect(await useGameStore.getState().startLife(newCharacter())).toBe(false);
    expect(useGameStore.getState().character?.id).toBe(existing.character.id);
  });

  it('advances one calendar month while autosaving', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const initialCharacter = useGameStore.getState().character!;

    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(true);

    expect(useGameStore.getState().character?.currentYear).toBe(initialCharacter.currentYear);
    expect(useGameStore.getState().character?.currentMonth).toBe(initialCharacter.currentMonth + 1);
    expect(useGameStore.getState().character?.age).toBe(0);
    expect(saveActiveGame).toHaveBeenCalled();
  });

  it('resumes a one-year run after scheduled events until all twelve months are processed', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const character = useGameStore.getState().character!;
    useGameStore.setState({
      character: { ...character, age: 30, currentYear: 2025, currentMonth: 12 },
    });

    expect(await useGameStore.getState().advanceYear(() => 0.99)).toBe(true);
    expect(useGameStore.getState().character?.currentMonth).toBe(1);
    expect(useGameStore.getState().activeEvent?.id).toBe('calendar-new-year');
    expect(useGameStore.getState().eventProgress.yearAdvanceRemaining).toBe(11);

    expect(await useGameStore.getState().chooseEventChoice('new-year-health')).toBe(true);
    expect(useGameStore.getState().eventProgress.yearAdvanceRemaining).toBe(11);
    expect(await useGameStore.getState().advanceYear(() => 0.99)).toBe(true);
    expect(useGameStore.getState().character?.currentMonth).toBe(8);
    expect(useGameStore.getState().activeEvent?.id).toBe('calendar-independence-day');
    expect(useGameStore.getState().eventProgress.yearAdvanceRemaining).toBe(4);

    expect(await useGameStore.getState().chooseEventChoice('independence-rest')).toBe(true);
    expect(await useGameStore.getState().advanceYear(() => 0.99)).toBe(true);
    expect(useGameStore.getState().character?.currentYear).toBe(2026);
    expect(useGameStore.getState().character?.currentMonth).toBe(12);
    expect(useGameStore.getState().activeEvent?.id).toBe('calendar-year-end');
    expect(useGameStore.getState().eventProgress.yearAdvanceRemaining).toBeUndefined();
  });

  it('creates and saves social relationships while blocking interaction during an active event', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const currentCharacter = useGameStore.getState().character!;
    const cash = 5_000_000;
    useGameStore.setState({
      character: {
        ...currentCharacter,
        age: 30,
        currentYear: 2030,
        cash,
        netWorth: cash + currentCharacter.startingAssets.nonCashValue,
      },
    });

    expect(await useGameStore.getState().meetNewPerson(() => 0.1)).toBe(true);
    const relationship = useGameStore.getState().character?.relationships[0];
    expect(relationship?.name).toBeTruthy();
    expect(saveActiveGame).toHaveBeenCalledOnce();
    expect(vi.mocked(saveActiveGame).mock.calls[0][0].character.relationships).toHaveLength(1);

    useGameStore.setState({ activeEvent: scholarshipEvent });
    expect(await useGameStore.getState().interactWithRelationship(relationship!.id, 'talk')).toBe(false);
    expect(saveActiveGame).toHaveBeenCalledOnce();
  });

  it('saves property purchases and economy actions through the canonical store', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const currentCharacter = useGameStore.getState().character!;
    const cash = 500_000_000;
    useGameStore.setState({
      character: {
        ...currentCharacter,
        age: 30,
        currentYear: 2026,
        cash,
        netWorth: cash + currentCharacter.startingAssets.nonCashValue,
      },
    });

    expect(await useGameStore.getState().buyProperty('rental-home')).toBe(true);
    expect(useGameStore.getState().character?.assets[0].propertyType).toBe('rental');
    expect(vi.mocked(saveActiveGame).mock.calls[0][0].character.assets[0].propertyType).toBe('rental');
    expect(await useGameStore.getState().invest(1_000_000, 'deposit')).toBe(true);
    expect(useGameStore.getState().character?.assets.some((asset) => asset.category === 'investment')).toBe(true);
  });

  it('applies event consequences before advancing age', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const newAdult = {
      ...useGameStore.getState().character!,
      age: 18,
      currentYear: 2018,
      educationRecord: createEducationRecordFromLegacy('Lulus Sekolah Menengah Atas', 2018),
    };
    useGameStore.setState({ character: newAdult });
    useGameStore.setState({ activeEvent: scholarshipEvent });
    const initialCash = useGameStore.getState().character!.cash;

    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(false);
    expect(await useGameStore.getState().chooseEventChoice('work')).toBe(true);
    expect(useGameStore.getState().character?.cash).toBe(initialCash);
    expect(useGameStore.getState().character?.careerRecord.status).toBe('employed');
    expect(useGameStore.getState().activeEvent).toBeNull();
    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(true);
    expect(useGameStore.getState().character?.age).toBe(18);
    expect(useGameStore.getState().character?.lastYearIncome).toBeGreaterThan(0);
    expect(useGameStore.getState().eventProgress.completedEventIds).toContain(scholarshipEvent.id);
    expect(useGameStore.getState().eventProgress.history[0].choiceId).toBe('work');
  });

  it('rejects event choices whose cash requirement is not met', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const event = {
      ...scholarshipEvent,
      choices: scholarshipEvent.choices.map((choice) => (
        choice.id === 'work' ? { ...choice, minimumCash: Number.MAX_SAFE_INTEGER } : choice
      )),
    };
    useGameStore.setState({ activeEvent: event });

    expect(await useGameStore.getState().chooseEventChoice('work')).toBe(false);
    expect(useGameStore.getState().activeEvent?.id).toBe(scholarshipEvent.id);
    expect(saveActiveGame).not.toHaveBeenCalled();
  });

  it('rejects choices with unmet organization requirements in the store', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const event = {
      ...scholarshipEvent,
      choices: [{
        ...scholarshipEvent.choices[0],
        requirements: { requiredOrganizationIds: ['community-reading-room'] },
      }],
    };
    useGameStore.setState({ activeEvent: event });

    expect(await useGameStore.getState().chooseEventChoice(event.choices[0].id)).toBe(false);
    expect(useGameStore.getState().activeEvent?.id).toBe(scholarshipEvent.id);
    expect(saveActiveGame).not.toHaveBeenCalled();
  });

  it('persists identity edits without resetting the life', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());

    await useGameStore.getState().updateCharacterIdentity({
      firstName: 'Nara Baru',
      lastName: 'Putri',
      gender: 'female',
      avatarId: 'ocean',
    });

    expect(useGameStore.getState().character?.identity.firstName).toBe('Nara Baru');
    expect(useGameStore.getState().character?.age).toBe(0);
    const history = useGameStore.getState().history;
    expect(history[history.length - 1]).toContain('Identitas Nara Baru Putri diperbarui');
    expect(saveActiveGame).toHaveBeenCalled();
  });

  it('saves education and career actions through the shared game store', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const character = useGameStore.getState().character!;
    useGameStore.setState({
      character: {
        ...character,
        age: 20,
        currentYear: 2020,
        educationRecord: createEducationRecordFromLegacy('Lulus Sekolah Menengah Atas', 2020),
        stats: {
          health: 100,
          happiness: 100,
          intelligence: 100,
          looks: 80,
          energy: 100,
          reputation: 100,
          wealth: 50,
        },
      },
    });

    expect(await useGameStore.getState().enrollInProgram(
      'd1-akuntansi',
      'universitas-nusantara-maju',
    )).toBe(true);
    expect(useGameStore.getState().character?.educationRecord.programId).toBe('d1-akuntansi');
    expect(await useGameStore.getState().applyForOccupation('entry-worker')).toBe(true);
    const application = useGameStore.getState().character!.careerRecord.applications[0];
    expect(application.status).toBe('offered');
    expect(await useGameStore.getState().acceptJobOffer(application.id)).toBe(true);
    expect(useGameStore.getState().character?.careerRecord.status).toBe('employed');
    expect(saveActiveGame).toHaveBeenCalledTimes(3);
  });

  it('exposes autosave failures instead of hiding them', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const initialHistory = useGameStore.getState().history;
    vi.mocked(saveActiveGame).mockRejectedValue(new Error('IndexedDB unavailable'));

    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(false);
    expect(useGameStore.getState().character?.age).toBe(0);
    expect(useGameStore.getState().character?.currentYear).toBe(2000);
    expect(useGameStore.getState().history).toEqual(initialHistory);
    expect(useGameStore.getState().isAdvancing).toBe(false);
    expect(useGameStore.getState().persistenceStatus).toBe('error');
    expect(useGameStore.getState().persistenceError).toContain('IndexedDB unavailable');
  });

  it('prevents duplicate age-up requests while the year save is pending', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    let finishSave: (() => void) | undefined;
    vi.mocked(saveActiveGame).mockImplementation(() => new Promise<void>((resolve) => {
      finishSave = resolve;
    }));

    const firstAdvance = useGameStore.getState().advanceMonth(() => 0.99);
    expect(useGameStore.getState().isAdvancing).toBe(true);
    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(false);
    finishSave?.();

    expect(await firstAdvance).toBe(true);
    expect(useGameStore.getState().character?.age).toBe(0);
    expect(saveActiveGame).toHaveBeenCalledOnce();
  });

  it('does not age deceased characters', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());
    const character = useGameStore.getState().character!;
    useGameStore.setState({ character: { ...character, status: 'deceased' } });
    const initialHistory = useGameStore.getState().history;

    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(false);
    expect(useGameStore.getState().character?.age).toBe(0);
    expect(useGameStore.getState().history).toEqual(initialHistory);
  });

  it('saves a death record and permanently blocks later age-up calls', async () => {
    await useGameStore.getState().hydrate();
    await useGameStore.getState().startLife(newCharacter());

    expect(await useGameStore.getState().advanceMonth(() => 0)).toBe(true);
    const deceased = useGameStore.getState().character!;
    expect(deceased.status).toBe('deceased');
    expect(deceased.deathRecord?.age).toBe(0);
    expect(deceased.deathRecord?.year).toBe(2000);
    expect(useGameStore.getState().history.some((entry) => entry.includes('Kehidupan berakhir'))).toBe(true);
    expect(await useGameStore.getState().advanceMonth(() => 0.99)).toBe(false);
    expect(useGameStore.getState().character?.age).toBe(0);
  });
});
