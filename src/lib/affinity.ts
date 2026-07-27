import type { NewsItem, Prefs, ScoringConfig } from './types';
import { PREFS_VERSION } from '../../config/scoring';

export function emptyPrefs(): Prefs {
  return { version: PREFS_VERSION, tags: {}, sources: {}, categories: {}, hidden: [], seen: [], viewed: [] };
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
  let raw = 0;
  for (const t of item.tags) raw += prefs.tags[t] ?? 0;
  for (const c of item.categories) raw += cfg.alphaCategory * (prefs.categories[c] ?? 0);
  raw += cfg.betaSource * (prefs.sources[item.source] ?? 0);
  // (-1,1) に飽和させる（spec §7.2 の「正規化して合算」）。
  // 重みが育っても recency と explore の影響力が残り、フィードが硬直しない。
  const aff = raw / (1 + Math.abs(raw));
  const explore = rand() * cfg.explore;
  return cfg.wRecency * recency + cfg.wAffinity * aff + explore;
}

/** 🙅 の取り消し: hidden から外し、down で引いた重みを戻す（非破壊）。 */
export function unhideItem(prefs: Prefs, item: NewsItem, cfg: ScoringConfig): Prefs {
  const p: Prefs = structuredClone(prefs);
  p.hidden = p.hidden.filter((id) => id !== item.id);
  for (const t of item.tags) p.tags[t] = (p.tags[t] ?? 0) + cfg.wDown;
  for (const c of item.categories) p.categories[c] = (p.categories[c] ?? 0) + cfg.wDown;
  p.sources[item.source] = (p.sources[item.source] ?? 0) + cfg.wDown;
  return p;
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
