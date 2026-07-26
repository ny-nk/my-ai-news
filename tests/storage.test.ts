import { describe, it, expect } from 'vitest';
import {
  loadPrefs, savePrefs, resetPrefs, serializePrefs, parsePrefsBackup, type StorageLike,
} from '../src/lib/storage';
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

describe('prefs backup', () => {
  it('round-trips through serialize/parse', () => {
    const p = emptyPrefs();
    p.tags['LLM'] = 2;
    p.sources['ITmedia AI+'] = -1;
    p.categories['研究・論文'] = 0.5;
    p.hidden.push('abc123');
    p.seen.push('def456');
    const restored = parsePrefsBackup(serializePrefs(p));
    expect(restored).toEqual(p);
  });

  it('rejects corrupt json, wrong version, and non-object payloads', () => {
    expect(parsePrefsBackup('{not json')).toBeNull();
    expect(parsePrefsBackup(JSON.stringify([1, 2, 3]))).toBeNull();
    expect(parsePrefsBackup('null')).toBeNull();
    expect(parsePrefsBackup(JSON.stringify({ ...emptyPrefs(), version: PREFS_VERSION + 1 }))).toBeNull();
  });

  it('rejects malformed sub-fields instead of trusting them', () => {
    const bad = (over: Record<string, unknown>) =>
      parsePrefsBackup(JSON.stringify({ ...emptyPrefs(), ...over }));
    expect(bad({ tags: null })).toBeNull();
    expect(bad({ tags: { LLM: 'lots' } })).toBeNull();
    expect(bad({ sources: [] })).toBeNull();
    expect(bad({ hidden: 'oops' })).toBeNull();
    expect(bad({ seen: [1, 2] })).toBeNull();
  });
});
