import { describe, it, expect } from 'vitest';
import { mergeViewed } from '../src/lib/enhance';
import { emptyPrefs } from '../src/lib/affinity';

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
