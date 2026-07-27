import { describe, it, expect } from 'vitest';
import { emptyPrefs, computeScore, updatePrefs, unhideItem } from '../src/lib/affinity';
import { SCORING } from '../config/scoring';
import type { NewsItem } from '../src/lib/types';

const NOW = Date.parse('2026-07-20T00:00:00Z');
const DAY = 86400000;
function item(over: Partial<NewsItem> = {}): NewsItem {
  return { id: 'a', title: 't', url: 'u', source: 'Src', publishedAt: new Date(NOW).toISOString(),
    summary: '', categories: ['LLM・チャットAI'], tags: ['LLM'], lang: 'en', ...over };
}
const noExplore = { ...SCORING, explore: 0 };
const zeroRand = () => 0;

describe('emptyPrefs', () => {
  it('starts empty with version', () => {
    const p = emptyPrefs();
    expect(p.hidden).toEqual([]);
    expect(p.version).toBeGreaterThan(0);
  });
});

describe('computeScore', () => {
  it('fresh item scores higher than old (recency)', () => {
    const fresh = computeScore(item(), emptyPrefs(), noExplore, NOW, zeroRand);
    const old = computeScore(item({ publishedAt: new Date(NOW - 6 * DAY).toISOString() }), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(fresh).toBeGreaterThan(old);
  });
  it('positive tag affinity raises score', () => {
    const p = emptyPrefs(); p.tags['LLM'] = 5;
    const liked = computeScore(item(), p, noExplore, NOW, zeroRand);
    const neutral = computeScore(item(), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(liked).toBeGreaterThan(neutral);
  });
  it('empty publishedAt gives zero recency', () => {
    const s = computeScore(item({ publishedAt: '' }), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(s).toBe(0);
  });
  it('affinity saturates: a heavy profile cannot bury fresh items forever', () => {
    // 30日分の学習相当の重み（正規化がないと recency が無力化する）
    const p = emptyPrefs();
    p.tags['LLM'] = 80;
    const oldOnProfile = computeScore(
      item({ publishedAt: new Date(NOW - 6 * DAY).toISOString() }), p, noExplore, NOW, zeroRand);
    const freshOffProfile = computeScore(
      item({ tags: [], categories: [], source: 'Other', publishedAt: new Date(NOW).toISOString() }),
      p, noExplore, NOW, zeroRand);
    expect(freshOffProfile).toBeGreaterThan(oldOnProfile);
  });
  it('affinity contribution is bounded to ±wAffinity', () => {
    const p = emptyPrefs();
    p.tags['LLM'] = 1000;
    const s = computeScore(item({ publishedAt: '' }), p, noExplore, NOW, zeroRand);
    expect(s).toBeLessThanOrEqual(noExplore.wAffinity);
    expect(s).toBeGreaterThan(0);
  });
});

describe('updatePrefs', () => {
  it('up increases tag/category/source weights, non-mutating', () => {
    const p0 = emptyPrefs();
    const p1 = updatePrefs(p0, item(), 'up', SCORING);
    expect(p1.tags['LLM']).toBe(SCORING.wUp);
    expect(p1.categories['LLM・チャットAI']).toBe(SCORING.wUp);
    expect(p1.sources['Src']).toBe(SCORING.wUp);
    expect(p0.tags['LLM']).toBeUndefined(); // original untouched
  });
  it('down decreases weights and hides the item', () => {
    const p = updatePrefs(emptyPrefs(), item(), 'down', SCORING);
    expect(p.tags['LLM']).toBe(-SCORING.wDown);
    expect(p.hidden).toContain('a');
  });
  it('click adds small weight and marks seen', () => {
    const p = updatePrefs(emptyPrefs(), item(), 'click', SCORING);
    expect(p.tags['LLM']).toBe(SCORING.wClick);
    expect(p.seen).toContain('a');
  });
});

describe('並び順の安定性', () => {
  it('同じ記事のスコアは何度計算しても同じ（リロードで順位が動かない）', () => {
    const p = emptyPrefs();
    const it = item();
    const a = computeScore(it, p, SCORING, NOW);
    const b = computeScore(it, p, SCORING, NOW);
    const c = computeScore(it, p, SCORING, NOW);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
  it('記事が違えば探索値も違う（多様性は維持される）', () => {
    const p = emptyPrefs();
    const values = ['a1', 'b2', 'c3', 'd4', 'e5'].map((id) =>
      computeScore(item({ id, publishedAt: '' }), p, SCORING, NOW),
    );
    expect(new Set(values).size).toBeGreaterThan(1);
  });
  it('探索値は 0〜explore の範囲に収まる', () => {
    const p = emptyPrefs();
    for (const id of ['x', 'yy', 'zzz', 'article-12345', '']) {
      const s = computeScore(item({ id, publishedAt: '' }), p, SCORING, NOW);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(SCORING.explore);
    }
  });
});

describe('unhideItem', () => {
  it('undoes a down signal: unhides and restores weights', () => {
    const start = emptyPrefs();
    const hidden = updatePrefs(start, item(), 'down', SCORING);
    const undone = unhideItem(hidden, item(), SCORING);
    expect(undone.hidden).not.toContain('a');
    expect(undone.tags['LLM']).toBe(0);
    expect(undone.categories['LLM・チャットAI']).toBe(0);
    expect(undone.sources['Src']).toBe(0);
  });
  it('is non-mutating and leaves other hidden ids alone', () => {
    const p0 = updatePrefs(emptyPrefs(), item({ id: 'keep' }), 'down', SCORING);
    const p1 = updatePrefs(p0, item(), 'down', SCORING);
    const p2 = unhideItem(p1, item(), SCORING);
    expect(p2.hidden).toEqual(['keep']);
    expect(p1.hidden).toEqual(['keep', 'a']); // input untouched
  });
});
