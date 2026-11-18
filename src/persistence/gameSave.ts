import Dexie from 'dexie';
import { gameDatabase, type PersistedGame } from './gameDatabase';

export async function loadActiveGame(): Promise<PersistedGame | undefined> {
  return gameDatabase.saves.get('active');
}

export async function createActiveGameIfAbsent(
  game: Omit<PersistedGame, 'id' | 'version' | 'updatedAt'>,
): Promise<boolean> {
  try {
    await gameDatabase.saves.add({
      ...game,
      id: 'active',
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
): Promise<void> {
  await gameDatabase.saves.put({
    ...game,
    id: 'active',
    version: 6,
    updatedAt: Date.now(),
  });
}
