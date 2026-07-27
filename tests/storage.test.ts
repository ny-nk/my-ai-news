import { describe, it, expect } from 'vitest';
import {
  loadPrefs, savePrefs, resetPrefs, serializePrefs, parsePrefsBackup, type StorageLike,
} from '../src/lib/storage';
import { emptyPrefs } from '../src/lib/affinity';
import { STORAGE_KEY, LEGACY_STORAGE_KEY, PREFS_VERSION } from '../config/scoring';

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
  it('returns emptyPrefs when a stored sub-field is malformed (no crash later)', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ ...emptyPrefs(), tags: null }));
    expect(loadPrefs(store)).toEqual(emptyPrefs());
    store.setItem(STORAGE_KEY, JSON.stringify({ ...emptyPrefs(), hidden: 'oops' }));
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('savePrefs swallows storage failures (Safari private mode etc.)', () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(() => savePrefs(emptyPrefs(), throwing)).not.toThrow();
  });
  it('migrates prefs from the legacy (my-ai-news) key once', () => {
    const store = fakeStore();
    const p = emptyPrefs(); p.tags['LLM'] = 4;
    store.setItem(LEGACY_STORAGE_KEY, JSON.stringify(p));
    const loaded = loadPrefs(store);
    expect(loaded.tags['LLM']).toBe(4);
    expect(store.getItem(STORAGE_KEY)).not.toBeNull(); // 新キーへ保存済み
    expect(store.getItem(LEGACY_STORAGE_KEY)).toBeNull(); // 旧キーは掃除
  });
  it('prefers the new key when both exist', () => {
    const store = fakeStore();
    const oldP = emptyPrefs(); oldP.tags['OLD'] = 1;
    const newP = emptyPrefs(); newP.tags['NEW'] = 2;
    store.setItem(LEGACY_STORAGE_KEY, JSON.stringify(oldP));
    store.setItem(STORAGE_KEY, JSON.stringify(newP));
    expect(loadPrefs(store).tags['NEW']).toBe(2);
  });
  it('viewed の無い古いデータも読める（後方互換）', () => {
    const store = fakeStore();
    const old = { ...emptyPrefs() } as unknown as Record<string, unknown>;
    delete old.viewed; // viewed 導入前に保存されたデータ
    store.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(loadPrefs(store).viewed).toEqual([]);
  });
  it('viewed が壊れていれば初期化する', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ ...emptyPrefs(), viewed: 'oops' }));
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('viewed を保存して読み戻せる', () => {
    const store = fakeStore();
    const p = emptyPrefs();
    p.viewed.push('abc123');
    savePrefs(p, store);
    expect(loadPrefs(store).viewed).toEqual(['abc123']);
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
