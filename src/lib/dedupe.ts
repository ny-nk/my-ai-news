import type { NewsItem } from './types';
import { normalizeTitle } from './normalize';

export function dedupe(items: NewsItem[]): NewsItem[] {
  const seenId = new Set<string>();
  const seenTitle = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const t = normalizeTitle(it.title);
    if (seenId.has(it.id) || (t && seenTitle.has(t))) continue;
    seenId.add(it.id);
    if (t) seenTitle.add(t);
    out.push(it);
  }
  return out;
}

export function trim(items: NewsItem[], now: number, days = 14, max = 300): NewsItem[] {
  const cutoff = now - days * 86400000;
  return items
    .filter((it) => {
      if (!it.publishedAt) return false;
      const ts = new Date(it.publishedAt).getTime();
      return !Number.isNaN(ts) && ts >= cutoff;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, max);
}
