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
    // バックアップと同じ検証を通す（version だけでなく各フィールドの型も見る）。
    // 壊れたデータを素通しすると affinity 側で実行時クラッシュするため。
    return parsePrefsBackup(raw) ?? emptyPrefs();
  } catch {
    return emptyPrefs();
  }
}

export function savePrefs(prefs: Prefs, store: StorageLike = globalThis.localStorage): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // 保存不可（Safari プライベートモード・容量超過）でも操作自体は続行させる
  }
}

export function resetPrefs(store: StorageLike = globalThis.localStorage): void {
  store.removeItem(STORAGE_KEY);
}

/** バックアップ用 JSON 文字列（人が読める整形付き）。 */
export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify(prefs, null, 2);
}

function isWeightMap(v: unknown): v is Record<string, number> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isIdList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

/**
 * バックアップ JSON を検証して Prefs にする。
 * 不正・別バージョンなら null（呼び出し側でユーザーに通知する）。
 */
export function parsePrefsBackup(raw: string): Prefs | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const p = parsed as Partial<Prefs>;
  if (p.version !== PREFS_VERSION) return null;
  if (!isWeightMap(p.tags) || !isWeightMap(p.sources) || !isWeightMap(p.categories)) return null;
  if (!isIdList(p.hidden) || !isIdList(p.seen)) return null;
  return {
    version: PREFS_VERSION,
    tags: p.tags,
    sources: p.sources,
    categories: p.categories,
    hidden: p.hidden,
    seen: p.seen,
  };
}
