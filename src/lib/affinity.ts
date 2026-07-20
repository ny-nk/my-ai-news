import type { NewsItem, Prefs, ScoringConfig } from './types';
import { PREFS_VERSION } from '../../config/scoring';

export function emptyPrefs(): Prefs {
  return { version: PREFS_VERSION, tags: {}, sources: {}, categories: {}, hidden: [], seen: [] };
}

function ageDays(iso: string, now: number): number {
  return Math.max(0, (now - new Date(iso).getTime()) / 86400000);
}

export function computeScore(
  item: NewsItem,
  prefs: Prefs,
  cfg: ScoringConfig,
  now: number,
  rand: () => number = Math.random,
): number {
  const recency = item.publishedAt ? Math.pow(0.5, ageDays(item.publishedAt, now) / cfg.halfLifeDays) : 0;
  let aff = 0;
  for (const t of item.tags) aff += prefs.tags[t] ?? 0;
  for (const c of item.categories) aff += cfg.alphaCategory * (prefs.categories[c] ?? 0);
  aff += cfg.betaSource * (prefs.sources[item.source] ?? 0);
  const explore = rand() * cfg.explore;
  return cfg.wRecency * recency + cfg.wAffinity * aff + explore;
}

export function updatePrefs(
  prefs: Prefs,
  item: NewsItem,
  signal: 'up' | 'down' | 'click',
  cfg: ScoringConfig,
): Prefs {
  const p: Prefs = structuredClone(prefs);
  const delta = signal === 'up' ? cfg.wUp : signal === 'down' ? -cfg.wDown : cfg.wClick;
  for (const t of item.tags) p.tags[t] = (p.tags[t] ?? 0) + delta;
  for (const c of item.categories) p.categories[c] = (p.categories[c] ?? 0) + delta;
  p.sources[item.source] = (p.sources[item.source] ?? 0) + delta;
  if (signal === 'down' && !p.hidden.includes(item.id)) p.hidden.push(item.id);
  if (signal === 'click' && !p.seen.includes(item.id)) p.seen.push(item.id);
  return p;
}
