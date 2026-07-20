import { describe, it, expect } from 'vitest';
import {
  normalizeUrl, stableId, stripHtml, truncate, toIso, normalizeTitle, normalizeItem,
} from '../src/lib/normalize';

describe('normalizeUrl', () => {
  it('strips utm/tracking params and hash, lowercases host', () => {
    expect(normalizeUrl('https://Example.com/a/?utm_source=x&id=5#frag'))
      .toBe('https://example.com/a?id=5');
  });
  it('removes trailing slash except root', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe('https://example.com/a');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });
  it('returns input on invalid url', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('stableId', () => {
  it('is deterministic and 16 hex chars', () => {
    const a = stableId('https://example.com/a');
    const b = stableId('https://example.com/a');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('stripHtml/truncate', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtml('<p>Hello&nbsp;&amp; <b>world</b></p>')).toBe('Hello & world');
  });
  it('truncates with ellipsis', () => {
    expect(truncate('abcdef', 3)).toBe('abc…');
    expect(truncate('ab', 3)).toBe('ab');
  });
});

describe('toIso', () => {
  it('parses valid dates to ISO', () => {
    expect(toIso('2026-07-20T00:00:00Z')).toBe('2026-07-20T00:00:00.000Z');
  });
  it('returns empty string on missing/invalid', () => {
    expect(toIso(undefined)).toBe('');
    expect(toIso('nonsense')).toBe('');
  });
});

describe('normalizeItem', () => {
  it('produces a NewsItem with stable id and cleaned summary', () => {
    const item = normalizeItem({
      title: '  Big News  ',
      url: 'https://Example.com/post/?utm_medium=rss',
      source: 'Example',
      publishedAt: '2026-07-20T10:00:00Z',
      summary: '<p>Some <b>summary</b></p>',
      lang: 'en',
    });
    expect(item.url).toBe('https://example.com/post');
    expect(item.id).toBe(stableId('https://example.com/post'));
    expect(item.title).toBe('Big News');
    expect(item.summary).toBe('Some summary');
    expect(item.categories).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.lang).toBe('en');
  });
});
