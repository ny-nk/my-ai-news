import { describe, it, expect } from 'vitest';
import { dedupe, trim } from '../src/lib/dedupe';
import type { NewsItem } from '../src/lib/types';

function n(id: string, title: string, publishedAt: string): NewsItem {
  return { id, title, url: 'u' + id, source: 's', publishedAt, summary: '', categories: [], tags: [], lang: 'en' };
}
const DAY = 86400000;
const NOW = Date.parse('2026-07-20T00:00:00Z');

describe('dedupe', () => {
  it('drops duplicate ids (keeps first)', () => {
    const out = dedupe([n('a', 'One', ''), n('a', 'One again', '')]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('One');
  });
  it('drops duplicate normalized titles', () => {
    const out = dedupe([n('a', 'Same  Title', ''), n('b', 'same title', '')]);
    expect(out).toHaveLength(1);
  });
});

describe('trim', () => {
  it('keeps only items within `days`, newest first', () => {
    const items = [
      n('old', 'Old', new Date(NOW - 20 * DAY).toISOString()),
      n('new', 'New', new Date(NOW - 1 * DAY).toISOString()),
      n('mid', 'Mid', new Date(NOW - 5 * DAY).toISOString()),
    ];
    const out = trim(items, NOW, 14, 300);
    expect(out.map((i) => i.id)).toEqual(['new', 'mid']);
  });
  it('caps at max', () => {
    const items = Array.from({ length: 5 }, (_, i) => n('i' + i, 't' + i, new Date(NOW - i * 1000).toISOString()));
    expect(trim(items, NOW, 14, 3)).toHaveLength(3);
  });
  it('drops items with empty publishedAt', () => {
    expect(trim([n('x', 'No date', '')], NOW, 14, 300)).toHaveLength(0);
  });
});
