import { describe, it, expect } from 'vitest';
import { fetchAll } from '../src/lib/fetch';
import type { Source, RawItem } from '../src/lib/types';

const sources: Source[] = [
  { name: 'Good', type: 'rss', lang: 'en', url: 'x' },
  { name: 'Bad', type: 'rss', lang: 'en', url: 'y' },
];

describe('fetchAll', () => {
  it('collects successes and records failures', async () => {
    const run = async (s: Source): Promise<RawItem[]> => {
      if (s.name === 'Bad') throw new Error('boom');
      return [{ title: 't', url: 'u', source: s.name, lang: 'en' }];
    };
    const { items, failures } = await fetchAll(sources, run);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('Good');
    expect(failures).toEqual(['Bad']);
  });
});
