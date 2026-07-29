import { describe, it, expect } from 'vitest';
import { mergeViewed, shouldTrackView } from '../src/lib/enhance';
import { emptyPrefs } from '../src/lib/affinity';

describe('shouldTrackView（既読として記録するかの判定）', () => {
  const base = { scrolled: true, intersecting: true, hiddenByFilter: false };

  it('スクロール後に画面内にあれば記録する', () => {
    expect(shouldTrackView(base)).toBe(true);
  });

  it('開いただけ（スクロールしていない）なら記録しない', () => {
    expect(shouldTrackView({ ...base, scrolled: false })).toBe(false);
  });

  it('画面内に入っていなければ記録しない', () => {
    expect(shouldTrackView({ ...base, intersecting: false })).toBe(false);
  });

  it('絞り込みで隠れているカードは記録しない', () => {
    expect(shouldTrackView({ ...base, hiddenByFilter: true })).toBe(false);
  });
});

describe('mergeViewed（閲覧済みの取り込み）', () => {
  it('新しい ID を追加する', () => {
    const next = mergeViewed(emptyPrefs(), ['a', 'b']);
    expect(next?.viewed).toEqual(['a', 'b']);
  });

  it('すでに記録済みなら null（無駄な保存をしない）', () => {
    const prefs = { ...emptyPrefs(), viewed: ['a'] };
    expect(mergeViewed(prefs, ['a'])).toBeNull();
  });

  it('重複を除いて取り込む', () => {
    const prefs = { ...emptyPrefs(), viewed: ['a'] };
    expect(mergeViewed(prefs, ['a', 'b', 'b'])?.viewed).toEqual(['a', 'b']);
  });

  it('空 ID は無視する', () => {
    expect(mergeViewed(emptyPrefs(), ['', ''])).toBeNull();
  });

  it('元の prefs を書き換えない', () => {
    const prefs = emptyPrefs();
    mergeViewed(prefs, ['a']);
    expect(prefs.viewed).toEqual([]);
  });

  it('他の項目はそのまま保つ', () => {
    const prefs = { ...emptyPrefs(), hidden: ['x'], seen: ['y'] };
    const next = mergeViewed(prefs, ['z']);
    expect(next?.hidden).toEqual(['x']);
    expect(next?.seen).toEqual(['y']);
  });
});
