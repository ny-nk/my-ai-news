import type { RawItem, NewsItem } from './types';
import { normalizeItem } from './normalize';
import { classify } from './classify';
import { dedupe, trim } from './dedupe';

export function assembleNews(
  raws: RawItem[],
  now: number,
  opts: { days?: number; max?: number } = {},
): NewsItem[] {
  const normalized = raws.map((r) => {
    const item = normalizeItem(r);
    const { categories, tags } = classify(item);
    return { ...item, categories, tags };
  });
  return trim(dedupe(normalized), now, opts.days, opts.max);
}
