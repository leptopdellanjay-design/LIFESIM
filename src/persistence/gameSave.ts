import Dexie from 'dexie';
import { gameDatabase, type PersistedGame } from './gameDatabase';
import { normalizeDigitalLifeRecord } from '../engine/digitalLifeEngine';

export const DEFAULT_SAVE_SLOT_ID = 'active';
const ACTIVE_SLOT_SETTING_ID = 'active-save-slot';

export interface SaveSlotSummary {
  id: string;
  characterName: string;
  age: number;
  year: number;
  month: number;
  updatedAt: number;
}

export async function getPreferredSaveSlotId(): Promise<string> {
  const setting = await gameDatabase.settings.get(ACTIVE_SLOT_SETTING_ID);
  return setting?.value || DEFAULT_SAVE_SLOT_ID;
}

export async function setPreferredSaveSlotId(id: string): Promise<void> {
  await gameDatabase.settings.put({ id: ACTIVE_SLOT_SETTING_ID, value: id });
}

export async function loadActiveGame(
  slotId = DEFAULT_SAVE_SLOT_ID,
): Promise<PersistedGame | undefined> {
  return gameDatabase.saves.get(slotId);
}

export async function listSavedGames(): Promise<SaveSlotSummary[]> {
  const saves = await gameDatabase.saves.orderBy('updatedAt').reverse().toArray();
  return saves.map((save) => ({
    id: save.id,
    characterName: `${save.character.identity.firstName} ${save.character.identity.lastName}`.trim(),
    age: save.character.age,
    year: save.character.currentYear,
    month: save.character.currentMonth,
    updatedAt: save.updatedAt,
  }));
}

export async function createActiveGameIfAbsent(
  game: Omit<PersistedGame, 'id' | 'version' | 'updatedAt'>,
  slotId = DEFAULT_SAVE_SLOT_ID,
): Promise<boolean> {
  try {
    await gameDatabase.saves.add({
      ...game,
      id: slotId,
      version: 6,
      updatedAt: Date.now(),
    });
    return true;
  } catch (error) {
    if (error instanceof Dexie.ConstraintError) return false;
    throw error;
  }
}

export async function saveActiveGame(
  game: Omit<PersistedGame, 'id' | 'version' | 'updatedAt'>,
  slotId = DEFAULT_SAVE_SLOT_ID,
): Promise<void> {
  await gameDatabase.saves.put({
    ...game,
    id: slotId,
    version: 6,
    updatedAt: Date.now(),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGameBackup(value: unknown): value is PersistedGame {
  if (!isRecord(value) || value.version !== 6 || !isRecord(value.character)
    || !Array.isArray(value.history) || !value.history.every((entry) => typeof entry === 'string')
    || !isRecord(value.eventProgress)) return false;

  const character = value.character;
  const identity = character.identity;
  const birthInformation = character.birthInformation;
  const stats = character.stats;
  const family = character.family;
  const location = isRecord(birthInformation) && isRecord(birthInformation.location)
    ? birthInformation.location
    : null;
  const progress = value.eventProgress;
  const event = value.activeEvent;
  const eventIsValid = event === null || (
    isRecord(event)
    && typeof event.id === 'string'
    && typeof event.title === 'string'
    && typeof event.description === 'string'
    && Array.isArray(event.choices)
    && event.choices.every((choice) => isRecord(choice)
      && typeof choice.id === 'string'
      && typeof choice.label === 'string'
      && isRecord(choice.consequence))
  );
  const progressIsValid = Array.isArray(progress.completedEventIds)
    && progress.completedEventIds.every((id) => typeof id === 'string')
    && isRecord(progress.lastEventYears)
    && Object.values(progress.lastEventYears).every(isFiniteNumber)
    && (progress.lastEventMonths === undefined
      || (isRecord(progress.lastEventMonths)
        && Object.values(progress.lastEventMonths).every(isFiniteNumber)))
    && (progress.yearAdvanceRemaining === undefined
      || (isFiniteNumber(progress.yearAdvanceRemaining)
        && Number.isInteger(progress.yearAdvanceRemaining)
        && progress.yearAdvanceRemaining >= 1
        && progress.yearAdvanceRemaining <= 11))
    && Array.isArray(progress.history)
    && progress.history.every((entry) => isRecord(entry)
      && typeof entry.eventId === 'string'
      && typeof entry.title === 'string'
      && typeof entry.choiceId === 'string')
    && Array.isArray(progress.pendingEventIds)
    && progress.pendingEventIds.every((id) => typeof id === 'string')
    && Array.isArray(progress.pendingConsequences)
    && progress.pendingConsequences.every((item) => isRecord(item) && typeof item.id === 'string')
    && Array.isArray(progress.processedConsequenceIds)
    && progress.processedConsequenceIds.every((id) => typeof id === 'string');

  return typeof value.id === 'string'
    && isRecord(identity)
    && typeof identity.firstName === 'string'
    && typeof identity.lastName === 'string'
    && isRecord(location)
    && typeof location.city === 'string'
    && typeof location.province === 'string'
    && typeof location.countryCode === 'string'
    && typeof location.currencyCode === 'string'
    && isRecord(stats)
    && ['health', 'happiness', 'intelligence', 'looks', 'energy', 'reputation', 'wealth']
      .every((key) => isFiniteNumber(stats[key]))
    && isRecord(family)
    && Array.isArray(family.members)
    && family.members.every((member) => isRecord(member)
      && typeof member.id === 'string'
      && typeof member.name === 'string')
    && Array.isArray(family.history)
    && family.history.every((entry) => typeof entry === 'string')
    && typeof character.id === 'string'
    && isFiniteNumber(character.age)
    && isFiniteNumber(character.currentYear)
    && (character.currentMonth === undefined
      || (isFiniteNumber(character.currentMonth)
        && Number.isInteger(character.currentMonth)
        && character.currentMonth >= 1
        && character.currentMonth <= 12))
    && isFiniteNumber(value.updatedAt)
    && progressIsValid
    && eventIsValid;
}

export async function exportGameBackup(slotId: string): Promise<string> {
  const save = await loadActiveGame(slotId);
  if (!save) throw new Error('Simpanan yang dipilih tidak ditemukan.');
  return JSON.stringify(save, null, 2);
}

export async function importGameBackup(
  serialized: string,
  targetSlotId: string,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('File cadangan bukan JSON yang valid.');
  }
  if (!isGameBackup(parsed)) {
    throw new Error('Struktur file cadangan tidak valid atau versinya tidak didukung.');
  }
  await gameDatabase.saves.put({
    ...parsed,
    character: normalizeDigitalLifeRecord(parsed.character),
    id: targetSlotId,
    version: 6,
    updatedAt: Date.now(),
  });
}
