import Dexie, { type Table } from 'dexie';
import type { Character, EventProgress, LifeEvent } from '../types/game';
import { createEducationRecordFromLegacy } from '../engine/educationEngine';
import { createCareerRecordFromLegacy } from '../engine/careerEngine';
import { normalizeFamilyRecords } from '../engine/familyEngine';
import { normalizeEconomyRecord } from '../engine/economyEngine';
import { normalizeDigitalLifeRecord } from '../engine/digitalLifeEngine';

export interface PersistedGame {
  id: string;
  version: number;
  character: Character;
  history: string[];
  activeEvent: LifeEvent | null;
  eventProgress: EventProgress;
  updatedAt: number;
}

export class GameDatabase extends Dexie {
  saves!: Table<PersistedGame, string>;
  settings!: Table<{ id: string; value: string }, string>;

  constructor(name = 'indolife') {
    super(name);
    this.version(1).stores({
      saves: 'id, updatedAt',
    });
    this.version(2).stores({
      saves: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.version = 2;
        save.eventProgress ??= {
          completedEventIds: [],
          lastEventYears: {},
          history: [],
          pendingEventIds: [],
          pendingConsequences: [],
          processedConsequenceIds: [],
        };
        save.character.birthEvent ??= {
          id: 'birth-recorded',
          title: 'Hari kelahiran',
          description: `Lahir di ${save.character.birthInformation.location.city}, ${save.character.birthInformation.location.province}; ini menjadi catatan awal perjalanan.`,
          statChanges: {},
        };
        save.character.deathRecord ??= null;
        save.character.lastYearIncome ??= 0;
        save.character.lastYearExpenses ??= 0;
      });
    });
    this.version(3).stores({
      saves: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.version = 3;
        save.eventProgress ??= {
          completedEventIds: [],
          lastEventYears: {},
          history: [],
          pendingEventIds: [],
          pendingConsequences: [],
          processedConsequenceIds: [],
        };
        save.eventProgress.pendingEventIds ??= [];
        save.eventProgress.pendingConsequences ??= [];
        save.eventProgress.processedConsequenceIds ??= [];
        save.eventProgress.completedEventIds ??= [];
        save.eventProgress.lastEventYears ??= {};
        save.eventProgress.history = (save.eventProgress.history ?? [])
          .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.eventId === 'string')
          .map((entry) => ({
            ...entry,
            category: entry.category ?? 'random_life',
            choiceId: entry.choiceId ?? 'legacy-choice',
            choiceLabel: entry.choiceLabel ?? 'Pilihan lama',
            outcomeText: entry.outcomeText ?? 'Rincian hasil pilihan tidak tersedia pada versi sebelumnya.',
          }));
        save.character.family.members.forEach((member) => {
          member.trust ??= member.relationship;
          member.loyalty ??= member.relationship;
        });
        save.character.debt ??= 0;
        save.character.assets ??= [];
        save.character.relationships ??= [];
        save.character.children ??= [];
        save.character.maritalStatus ??= 'single';
        save.character.spouseName ??= null;
        save.character.legalStatus ??= 'clear';
        save.character.organizations ??= [];
      });
    });
    this.version(4).stores({
      saves: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        const character = save.character as Character & {
          education?: string;
          occupation?: string | null;
        };
        character.educationRecord ??= createEducationRecordFromLegacy(
          character.education,
          character.currentYear,
        );
        character.careerRecord ??= createCareerRecordFromLegacy(
          character.occupation,
          character.currentYear,
        );
        delete character.education;
        delete character.occupation;
        save.version = 4;
      });
    });
    this.version(5).stores({
      saves: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.character = normalizeFamilyRecords(save.character);
        save.version = 5;
      });
    });
    this.version(6).stores({
      saves: 'id, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.character = normalizeEconomyRecord(save.character);
        save.version = 6;
      });
    });
    this.version(7).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    });
    this.version(8).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        const character = save.character as Character & {
          generation?: number;
          ancestors?: Character['ancestors'];
          estatePlan?: Character['estatePlan'];
          estateSettlement?: Character['estateSettlement'];
        };
        character.generation ??= 0;
        character.ancestors ??= [];
        character.estatePlan ??= {
          distribution: 'equal_heirs',
          namedHeirId: null,
          updatedYear: character.currentYear,
        };
        character.estateSettlement ??= null;
        character.children ??= [];
        character.children.forEach((child) => {
          child.gender ??= 'other';
          child.inheritanceCash ??= 0;
        });
      });
    });
    this.version(9).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.character.currentMonth ??= 1;
        save.eventProgress.lastEventMonths ??= {};
      });
    });
    this.version(10).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.character = normalizeFamilyRecords(save.character);
      });
    });
    this.version(11).stores({
      saves: 'id, updatedAt',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table('saves').toCollection().modify((save: PersistedGame) => {
        save.character = normalizeDigitalLifeRecord(save.character);
      });
    });
    this.saves = this.table('saves');
    this.settings = this.table('settings');
  }
}

export const gameDatabase = new GameDatabase();
