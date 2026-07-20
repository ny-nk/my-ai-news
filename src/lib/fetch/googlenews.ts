import type { RawItem, Lang } from '../types';
import { fetchRss } from './rss';

export function googleNewsUrl(query: string, lang: Lang): string {
  const locale = lang === 'ja'
    ? { hl: 'ja', gl: 'JP', ceid: 'JP:ja' }
    : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const qs = new URLSearchParams({ q: query, ...locale });
  return `https://news.google.com/rss/search?${qs.toString()}`;
}

export async function fetchGoogleNews(query: string, lang: Lang, source = 'Google News'): Promise<RawItem[]> {
  return fetchRss(googleNewsUrl(query, lang), source, lang);
}
