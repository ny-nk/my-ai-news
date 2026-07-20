import type { Prefs } from './types';
import { emptyPrefs } from './affinity';
import { STORAGE_KEY, PREFS_VERSION } from '../../config/scoring';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadPrefs(store: StorageLike = globalThis.localStorage): Prefs {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return emptyPrefs();
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    if (parsed?.version !== PREFS_VERSION) return emptyPrefs();
    return { ...emptyPrefs(), ...parsed } as Prefs;
  } catch {
    return emptyPrefs();
  }
}

export function savePrefs(prefs: Prefs, store: StorageLike = globalThis.localStorage): void {
  store.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function resetPrefs(store: StorageLike = globalThis.localStorage): void {
  store.removeItem(STORAGE_KEY);
}
