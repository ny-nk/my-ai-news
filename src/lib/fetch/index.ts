import type { RawItem, Source } from '../types';
import { fetchRss } from './rss';
import { fetchGoogleNews } from './googlenews';
import { fetchHackerNews } from './hackernews';
import { withRetry } from './http';

export async function fetchSource(s: Source): Promise<RawItem[]> {
  if (s.type === 'rss') return fetchRss(s.url as string, s.name, s.lang);
  if (s.type === 'googlenews') return fetchGoogleNews(s.query as string, s.lang, s.name);
  return fetchHackerNews(s.query as string);
}

export async function fetchAll(
  sources: Source[],
  run: (s: Source) => Promise<RawItem[]> = fetchSource,
): Promise<{ items: RawItem[]; failures: string[] }> {
  const items: RawItem[] = [];
  const failures: string[] = [];
  const results = await Promise.allSettled(sources.map((s) => withRetry(() => run(s))));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else failures.push(sources[i].name);
  });
  return { items, failures };
}
