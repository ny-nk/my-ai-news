import { describe, it, expect } from 'vitest';
import { CATEGORIES, DEFAULT_CATEGORY, RULES } from '../config/taxonomy';
import { SOURCES } from '../config/sources';
import { SCORING } from '../config/scoring';

describe('config', () => {
  it('has exactly 7 categories', () => {
    expect(CATEGORIES).toHaveLength(7);
  });
  it('default category is one of CATEGORIES', () => {
    expect(CATEGORIES).toContain(DEFAULT_CATEGORY);
  });
  it('every rule targets a known category', () => {
    for (const r of RULES) expect(CATEGORIES).toContain(r.category);
  });
  it('every source has the fields its type needs', () => {
    for (const s of SOURCES) {
      if (s.type === 'rss') expect(s.url).toBeTruthy();
      else expect(s.query).toBeTruthy();
    }
  });
  it('scoring weights are positive', () => {
    expect(SCORING.halfLifeDays).toBeGreaterThan(0);
    expect(SCORING.wRecency).toBeGreaterThan(0);
  });
});
