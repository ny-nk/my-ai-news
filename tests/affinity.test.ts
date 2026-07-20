import { describe, it, expect } from 'vitest';
import { emptyPrefs, computeScore, updatePrefs } from '../src/lib/affinity';
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
