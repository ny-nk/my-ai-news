import { describe, it, expect } from 'vitest';
import { mapAlgolia } from '../src/lib/fetch/hackernews';

describe('mapAlgolia', () => {
  it('maps hits and falls back to HN item url when url is null', () => {
    const out = mapAlgolia([
      { objectID: '1', title: 'External', url: 'https://ext.com/x', created_at: '2026-07-20T00:00:00Z' },
      { objectID: '2', title: 'Ask HN', url: null, created_at: '2026-07-20T01:00:00Z' },
      { objectID: '3', title: null, url: 'https://ext.com/y', created_at: '2026-07-20T02:00:00Z' },
    ]);
    expect(out).toHaveLength(2); // null-title dropped
    expect(out[0].url).toBe('https://ext.com/x');
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=2');
    expect(out[0].source).toBe('Hacker News');
    expect(out[0].lang).toBe('en');
  });
});
