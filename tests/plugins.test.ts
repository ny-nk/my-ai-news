import { describe, it, expect } from 'vitest';
import { PLUGINS, pluginsAsNewsItems } from '../config/plugins';
import { PLUGIN_CATEGORY } from '../config/taxonomy';

describe('plugins', () => {
  it('exposes a non-empty curated list', () => {
    expect(PLUGINS.length).toBeGreaterThan(0);
  });

  it('maps every plugin to a pinned NewsItem in the plugin category', () => {
    const items = pluginsAsNewsItems();
    expect(items).toHaveLength(PLUGINS.length);
    for (const it of items) {
      expect(it.pinned).toBe(true);
      expect(it.categories).toEqual([PLUGIN_CATEGORY]);
      expect(it.publishedAt).toBe(''); // 常設: 日付なし → トリム/recency 非対象
      expect(it.url).toBeTruthy();
      expect(it.title).toBeTruthy();
      expect(it.summary).toBeTruthy();
    }
  });

  it('assigns stable, unique, 16-hex ids', () => {
    const first = pluginsAsNewsItems().map((i) => i.id);
    const second = pluginsAsNewsItems().map((i) => i.id);
    expect(first).toEqual(second); // deterministic across calls
    expect(new Set(first).size).toBe(first.length); // unique per plugin
    expect(first.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
  });
});
