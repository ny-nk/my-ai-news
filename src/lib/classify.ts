import type { NewsItem, Rule } from './types';
import { RULES, DEFAULT_CATEGORY } from '../../config/taxonomy';

export function classify(item: NewsItem, rules: Rule[] = RULES): { categories: string[]; tags: string[] } {
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  const categories = new Set<string>();
  const tags = new Set<string>();
  for (const r of rules) {
    if (r.patterns.some((p) => hay.includes(p.toLowerCase()))) {
      categories.add(r.category);
      for (const t of r.tags ?? []) tags.add(t);
    }
  }
  if (categories.size === 0) categories.add(DEFAULT_CATEGORY);
  return { categories: [...categories], tags: [...tags] };
}
