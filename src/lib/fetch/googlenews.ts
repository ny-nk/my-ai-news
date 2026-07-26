import type { RawItem, Lang } from '../types';
import { fetchRss } from './rss';

export function googleNewsUrl(query: string, lang: Lang): string {
  const locale = lang === 'ja'
    ? { hl: 'ja', gl: 'JP', ceid: 'JP:ja' }
    : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const qs = new URLSearchParams({ q: query, ...locale });
  return `https://news.google.com/rss/search?${qs.toString()}`;
}

/**
 * Google News のタイトル末尾「 - 出版社」を source に移す。
 * これをしないと 4 割超の記事が「Google News (クエリ名)」で学習され、
 * ソース好みが実質無効になる（出典明記の観点でも実出版社が正）。
 */
export function extractPublisher(item: RawItem): RawItem {
  const idx = item.title.lastIndexOf(' - ');
  if (idx <= 0) return item;
  const publisher = item.title.slice(idx + 3).trim();
  if (!publisher || publisher.length > 60) return item;
  return { ...item, title: item.title.slice(0, idx).trim(), source: publisher };
}

export async function fetchGoogleNews(query: string, lang: Lang, source = 'Google News'): Promise<RawItem[]> {
  const items = await fetchRss(googleNewsUrl(query, lang), source, lang);
  return items.map(extractPublisher);
}
