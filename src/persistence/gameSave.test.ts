import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from '../engine/characterCreation';
import { GameDatabase, gameDatabase } from './gameDatabase';
import { createActiveGameIfAbsent, loadActiveGame, saveActiveGame } from './gameSave';

const character = createCharacter({
  ...initialCharacterDraft,
  firstName: 'Laras',
  lastName: 'Utami',
  gender: 'female',
  birthDate: '2020-03-10',
  familyBackground: 'modest',
  parentCondition: 'both_alive',
  personalityTraits: ['creative'],
}, {
  today: new Date('2026-11-18T12:00:00'),
  idFactory: () => 'indexeddb-character',
});

const eventProgress = {
  completedEventIds: [],
  lastEventYears: {},
  history: [],
  pendingEventIds: [],
  pendingConsequences: [],
  processedConsequenceIds: [],
};

describe('IndexedDB game saves', () => {
  beforeEach(async () => {
    await gameDatabase.saves.clear();
  });

  it('creates and reloads a complete game save', async () => {
    const created = await createActiveGameIfAbsent({
      character,
      history: ['2020: Lahir di Padang, Sumatera Barat.'],
      activeEvent: null,
      eventProgress,
    });

    const loaded = await loadActiveGame();

    expect(created).toBe(true);
    expect(loaded?.character.identity.firstName).toBe('Laras');
    expect(loaded?.history).toEqual(['2020: Lahir di Padang, Sumatera Barat.']);
    expect(loaded?.version).toBe(6);
    expect(loaded?.eventProgress).toEqual(eventProgress);
  });

  it('never overwrites an existing save when starting another life', async () => {
    await createActiveGameIfAbsent({
      character,
      history: ['2020: Lahir di Padang, Sumatera Barat.'],
      activeEvent: null,
      eventProgress,
    });
    const replacement = { ...character, id: 'replacement-character' };

    const created = await createActiveGameIfAbsent({
      character: replacement,
      history: ['2020: Data pengganti.'],
      activeEvent: null,
      eventProgress,
    });

    expect(created).toBe(false);
    expect((await loadActiveGame())?.character.id).toBe('indexeddb-character');
  });

  it('updates the active save without duplicating character records', async () => {
    await createActiveGameIfAbsent({
      character,
      history: ['2020: Lahir di Padang, Sumatera Barat.'],
      activeEvent: null,
      eventProgress,
    });
    const nextCharacter = { ...character, age: 1, currentYear: 2021 };
    await saveActiveGame({
      character: nextCharacter,
      history: ['2020: Lahir di Padang, Sumatera Barat.', '2021: Bertambah usia.'],
      activeEvent: null,
      eventProgress,
    });

    expect((await loadActiveGame())?.character.age).toBe(1);
    expect(await gameDatabase.saves.count()).toBe(1);
  });

  it('migrates a version 1 save without discarding its life history', async () => {
    const name = `indolife-migration-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(1).stores({ saves: 'id, updatedAt' });
    await legacyDatabase.open();
    const legacyCharacter = {
      ...character,
      education: 'Sekolah Dasar',
      occupation: 'Pekerja pemula',
    } as typeof character & { education?: string; occupation?: string | null };
    delete (legacyCharacter as Partial<typeof legacyCharacter>).birthEvent;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).deathRecord;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).lastYearIncome;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).lastYearExpenses;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).debt;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).assets;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).relationships;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).children;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).maritalStatus;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).spouseName;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).legalStatus;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).organizations;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).educationRecord;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).careerRecord;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).economyRecord;
    legacyCharacter.family.members.forEach((member) => {
      delete (member as Partial<typeof member>).trust;
      delete (member as Partial<typeof member>).loyalty;
    });
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 1,
      character: legacyCharacter,
      history: ['2020: Catatan lama tetap ada.'],
      activeEvent: null,
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.version).toBe(6);
    expect(migrated?.eventProgress.completedEventIds).toEqual([]);
    expect(migrated?.eventProgress.pendingEventIds).toEqual([]);
    expect(migrated?.character.birthEvent.title).toBe('Hari kelahiran');
    expect(migrated?.character.deathRecord).toBeNull();
    expect(migrated?.character.lastYearIncome).toBe(0);
    expect(migrated?.character.educationRecord.currentLevel).toBe('sd');
    expect(migrated?.character.careerRecord.currentOccupationId).toBe('entry-worker');
    expect(migrated?.character.debt).toBe(0);
    expect(migrated?.character.economyRecord.businesses).toEqual([]);
    expect(migrated?.character.economyRecord.monthlyBudgetYear).toBe(2026);
    expect(migrated?.character.family.members[0].trust).toBe(
      migrated?.character.family.members[0].relationship,
    );
    expect(migrated?.history).toEqual(['2020: Catatan lama tetap ada.']);
    await migratedDatabase.delete();
  });

  it('fills version 2 event progress defaults while preserving event choices', async () => {
    const name = `indolife-v2-migration-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(1).stores({ saves: 'id, updatedAt' });
    legacyDatabase.version(2).stores({ saves: 'id, updatedAt' });
    await legacyDatabase.open();
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 2,
      character,
      history: ['2000: Catatan lama tetap ada.'],
      activeEvent: null,
      eventProgress: {
        completedEventIds: ['legacy-event'],
        lastEventYears: { 'legacy-event': 2001 },
        history: [{
          eventId: 'legacy-event',
          title: 'Event lama',
          year: 2001,
          age: 1,
          choiceId: 'legacy-choice',
        }],
      },
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.version).toBe(6);
    expect(migrated?.eventProgress.completedEventIds).toEqual(['legacy-event']);
    expect(migrated?.eventProgress.pendingEventIds).toEqual([]);
    expect(migrated?.eventProgress.pendingConsequences).toEqual([]);
    expect(migrated?.eventProgress.history[0]).toMatchObject({
      eventId: 'legacy-event',
      category: 'random_life',
      choiceLabel: 'Pilihan lama',
      outcomeText: 'Rincian hasil pilihan tidak tersedia pada versi sebelumnya.',
    });
    expect(migrated?.history).toEqual(['2000: Catatan lama tetap ada.']);
    await migratedDatabase.delete();
  });

  it('migrates version 4 relationship and child records without replacing the save', async () => {
    const name = `indolife-v4-family-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(1).stores({ saves: 'id, updatedAt' });
    legacyDatabase.version(2).stores({ saves: 'id, updatedAt' });
    legacyDatabase.version(3).stores({ saves: 'id, updatedAt' });
    legacyDatabase.version(4).stores({ saves: 'id, updatedAt' });
    await legacyDatabase.open();
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 4,
      character: {
        ...character,
        relationships: [{
          id: 'legacy-friend',
          name: 'Teman lama',
          kind: 'friend',
          score: 45,
          trust: 40,
          loyalty: 35,
          status: 'active',
          startedYear: character.currentYear,
        }],
        children: [{
          id: 'legacy-child',
          name: 'Anak lama',
          birthYear: character.currentYear - 5,
          relationship: 60,
        }],
      },
      history: ['2020: Catatan lama tetap ada.'],
      activeEvent: null,
      eventProgress,
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.version).toBe(6);
    expect(migrated?.history).toEqual(['2020: Catatan lama tetap ada.']);
    expect(migrated?.character.relationships[0].profile?.lifeStatus).toBe('alive');
    expect(migrated?.character.children[0].lifeStatus).toBe('alive');
    expect(migrated?.character.children[0].trust).toBe(60);
    await migratedDatabase.delete();
  });
});
