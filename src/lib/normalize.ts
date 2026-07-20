import { createHash } from 'node:crypto';
import type { RawItem, NewsItem } from './types';

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|cmpid$|spm$)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (!TRACKING.test(k)) keep.append(k, v);
    u.search = keep.toString();
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function stableId(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s: string, n = 200): string {
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
}

export function toIso(input?: string): string {
  if (!input) return '';
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeItem(raw: RawItem): NewsItem {
  const url = normalizeUrl(raw.url);
  return {
    id: stableId(url),
    title: raw.title.trim(),
    url,
    source: raw.source,
    publishedAt: toIso(raw.publishedAt),
    summary: truncate(stripHtml(raw.summary ?? '')),
    categories: [],
    tags: [],
    lang: raw.lang,
  };
}
