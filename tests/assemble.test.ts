import { describe, it, expect } from 'vitest';
import { assembleNews } from '../src/lib/assemble';
import type { RawItem } from '../src/lib/types';

const NOW = Date.parse('2026-07-20T00:00:00Z');
const DAY = 86400000;

function raw(title: string, url: string, ageDays: number, summary = ''): RawItem {
  return { title, url, source: 'Src', publishedAt: new Date(NOW - ageDays * DAY).toISOString(), summary, lang: 'en' };
}

describe('assembleNews', () => {
  it('normalizes, classifies, dedupes and trims', () => {
    const raws = [
      raw('Claude LLM update', 'https://a.com/1?utm_source=x', 1, 'about LLM'),
      raw('Claude LLM update', 'https://a.com/1', 1), // dup by url+title
      raw('Old news', 'https://a.com/old', 40),        // out of window
    ];
    const out = assembleNews(raws, NOW, { days: 14, max: 300 });
    expect(out).toHaveLength(1);
    expect(out[0].categories).toContain('LLM・チャットAI');
    expect(out[0].url).toBe('https://a.com/1');
  });
});
