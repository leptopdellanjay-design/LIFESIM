import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from '../engine/characterCreation';
import { GameDatabase, gameDatabase } from './gameDatabase';
import {
  createActiveGameIfAbsent,
  exportGameBackup,
  importGameBackup,
  listSavedGames,
  loadActiveGame,
  saveActiveGame,
} from './gameSave';

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
    await gameDatabase.settings.clear();
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

  it('keeps independent save slots and restores a backup into the selected slot', async () => {
    const game = {
      character,
      history: ['2020: Catatan cadangan.'],
      activeEvent: null,
      eventProgress,
    };
    await createActiveGameIfAbsent(game, 'slot-one');
    await saveActiveGame({
      ...game,
      character: { ...character, age: 2, currentYear: 2022 },
    }, 'slot-two');

    const backup = await exportGameBackup('slot-one');
    await importGameBackup(backup, 'slot-three');
    const slots = await listSavedGames();

    expect(await loadActiveGame('slot-one')).toMatchObject({ character: { age: character.age } });
    expect(await loadActiveGame('slot-two')).toMatchObject({ character: { age: 2 } });
    expect(await loadActiveGame('slot-three')).toMatchObject({
      character: { id: 'indexeddb-character' },
      history: ['2020: Catatan cadangan.'],
    });
    expect(slots.map((slot) => slot.id).sort()).toEqual(['slot-one', 'slot-three', 'slot-two']);
  });

  it('preserves a paused annual run through backup restore and rejects invalid remainder values', async () => {
    await createActiveGameIfAbsent({
      character,
      history: ['2020: Catatan tahunan.'],
      activeEvent: null,
      eventProgress: { ...eventProgress, yearAdvanceRemaining: 7 },
    }, 'slot-one');
    const backup = await exportGameBackup('slot-one');
    await importGameBackup(backup, 'slot-two');

    expect((await loadActiveGame('slot-two'))?.eventProgress.yearAdvanceRemaining).toBe(7);
    const malformed = {
      ...JSON.parse(backup),
      eventProgress: { ...eventProgress, yearAdvanceRemaining: 12 },
    };
    await expect(importGameBackup(JSON.stringify(malformed), 'slot-invalid'))
      .rejects.toThrow('Struktur file cadangan tidak valid');
  });

  it('restores legacy backups without digital data into an initialized digital-life record', async () => {
    await createActiveGameIfAbsent({
      character,
      history: ['2020: Catatan cadangan.'],
      activeEvent: null,
      eventProgress,
    }, 'slot-one');
    const backup = JSON.parse(await exportGameBackup('slot-one')) as {
      character: Record<string, unknown>;
    };
    delete backup.character.digitalLife;

    await importGameBackup(JSON.stringify(backup), 'slot-restored');

    expect((await loadActiveGame('slot-restored'))?.character.digitalLife).toEqual({
      smartphone: null,
      accounts: [],
      content: [],
      transactions: [],
      creatorSkill: 0,
      creatorTitles: [],
      bankAccounts: [],
    });
  });

  it('normalizes legacy backups with no post-graduation or admission fields', async () => {
    await createActiveGameIfAbsent({
      character,
      history: ['2020: Catatan lama.'],
      activeEvent: null,
      eventProgress,
    }, 'slot-one');
    const backup = JSON.parse(await exportGameBackup('slot-one')) as {
      character: Record<string, unknown>;
    };
    delete backup.character.postGraduationPath;
    delete backup.character.admissionRecord;

    await importGameBackup(JSON.stringify(backup), 'slot-restored');

    expect((await loadActiveGame('slot-restored'))?.character).toMatchObject({
      postGraduationPath: 'not_applicable',
      admissionRecord: {
        status: 'not_started',
        selectedUniversityId: null,
        selectedProgramId: null,
      },
    });
  });

  it('rejects malformed or unsupported backup files without changing saves', async () => {
    await expect(importGameBackup('{not-json', 'slot-one')).rejects.toThrow('JSON yang valid');
    await expect(importGameBackup('{"version":99}', 'slot-one')).rejects.toThrow('versinya tidak didukung');
    await expect(importGameBackup(JSON.stringify({
      id: 'broken',
      version: 6,
      character: {},
      history: [],
      activeEvent: null,
      eventProgress: {},
      updatedAt: 1,
    }), 'slot-one')).rejects.toThrow('Struktur file cadangan tidak valid');
    expect(await gameDatabase.saves.count()).toBe(0);
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
    delete (legacyCharacter as Partial<typeof legacyCharacter>).generation;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).ancestors;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).estatePlan;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).estateSettlement;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).currentMonth;
    delete (legacyCharacter as Partial<typeof legacyCharacter>).digitalLife;
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
    expect(migrated?.character.generation).toBe(0);
    expect(migrated?.character.ancestors).toEqual([]);
    expect(migrated?.character.estatePlan.distribution).toBe('equal_heirs');
    expect(migrated?.character.estateSettlement).toBeNull();
    expect(migrated?.character.currentMonth).toBe(1);
    expect(migrated?.character.digitalLife).toEqual({
      smartphone: null,
      accounts: [],
      content: [],
      transactions: [],
      creatorSkill: 0,
      creatorTitles: [],
      bankAccounts: [],
    });
    expect(migrated?.eventProgress.lastEventMonths).toEqual({});
    expect(migrated?.character.family.members[0].trust).toBe(
      migrated?.character.family.members[0].relationship,
    );
    expect(migrated?.history).toEqual(['2020: Catatan lama tetap ada.']);
    await migratedDatabase.delete();
  });

  it('assigns parent jobs when upgrading a version 9 save', async () => {
    const name = `indolife-v9-migration-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(9).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    });
    await legacyDatabase.open();
    const legacyCharacter = {
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
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 6,
      character: legacyCharacter,
      history: ['2020: Catatan lama.'],
      activeEvent: null,
      eventProgress,
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.character.family.members.find((member) => member.role === 'father')?.occupationId)
      .toBeTruthy();
    expect(migrated?.character.family.members.find((member) => member.role === 'mother')?.occupationId)
      .toBeTruthy();
    await migratedDatabase.delete();
  });

  it('migrates version 11 saves with digital progression and bank defaults', async () => {
    const name = `indolife-v11-digital-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(11).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    });
    await legacyDatabase.open();
    const legacyCharacter = {
      ...character,
      digitalLife: { ...character.digitalLife },
    };
    Reflect.deleteProperty(legacyCharacter.digitalLife, 'creatorSkill');
    Reflect.deleteProperty(legacyCharacter.digitalLife, 'creatorTitles');
    Reflect.deleteProperty(legacyCharacter.digitalLife, 'bankAccounts');
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 6,
      character: legacyCharacter,
      history: [],
      activeEvent: null,
      eventProgress,
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.character.digitalLife.creatorSkill).toBe(0);
    expect(migrated?.character.digitalLife.creatorTitles).toEqual([]);
    expect(migrated?.character.digitalLife.bankAccounts).toEqual([]);
    expect(migrated?.version).toBe(6);
    await migratedDatabase.delete();
  });

  it('migrates version 12 saves with defaults for the graduation and admission flow', async () => {
    const name = `indolife-v12-admission-${Date.now()}`;
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(12).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    });
    await legacyDatabase.open();
    const legacyCharacter = { ...character };
    Reflect.deleteProperty(legacyCharacter, 'postGraduationPath');
    Reflect.deleteProperty(legacyCharacter, 'admissionRecord');
    await legacyDatabase.table('saves').add({
      id: 'active',
      version: 6,
      character: legacyCharacter,
      history: [],
      activeEvent: null,
      eventProgress,
      updatedAt: 1,
    });
    legacyDatabase.close();

    const migratedDatabase = new GameDatabase(name);
    const migrated = await migratedDatabase.saves.get('active');

    expect(migrated?.character.postGraduationPath).toBe('not_applicable');
    expect(migrated?.character.admissionRecord?.status).toBe('not_started');
    expect(migrated?.character.admissionRecord?.examAttempts).toBe(0);
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
