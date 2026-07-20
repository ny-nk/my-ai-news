import { describe, it, expect } from 'vitest';
import { loadPrefs, savePrefs, resetPrefs, type StorageLike } from '../src/lib/storage';
import { emptyPrefs } from '../src/lib/affinity';
import { STORAGE_KEY, PREFS_VERSION } from '../config/scoring';

function fakeStore(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('storage', () => {
  it('returns emptyPrefs when nothing stored', () => {
    expect(loadPrefs(fakeStore())).toEqual(emptyPrefs());
  });
  it('round-trips prefs', () => {
    const store = fakeStore();
    const p = emptyPrefs(); p.tags['LLM'] = 3;
    savePrefs(p, store);
    expect(loadPrefs(store).tags['LLM']).toBe(3);
  });
  it('returns emptyPrefs on corrupt json', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('returns emptyPrefs on version mismatch', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ ...emptyPrefs(), version: PREFS_VERSION + 1 }));
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('reset clears prefs', () => {
    const store = fakeStore();
    savePrefs(emptyPrefs(), store);
    resetPrefs(store);
    expect(store.getItem(STORAGE_KEY)).toBeNull();
  });
});
