import type { RawItem } from '../types';
import { fetchJson } from './http';

export interface AlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  created_at: string;
}

export function mapAlgolia(hits: AlgoliaHit[]): RawItem[] {
  return hits
    .filter((h) => h.title)
    .map((h) => ({
      title: h.title as string,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: 'Hacker News',
      publishedAt: h.created_at,
      summary: '',
      lang: 'en' as const,
    }));
}

export async function fetchHackerNews(
  query: string,
  getJson: <T>(u: string) => Promise<T> = fetchJson,
): Promise<RawItem[]> {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`;
  const data = await getJson<{ hits: AlgoliaHit[] }>(url);
  return mapAlgolia(data.hits ?? []);
}
