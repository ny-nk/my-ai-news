import { describe, it, expect } from 'vitest';
import { googleNewsUrl } from '../src/lib/fetch/googlenews';

describe('googleNewsUrl', () => {
  it('builds a ja search url', () => {
    const u = new URL(googleNewsUrl('生成AI', 'ja'));
    expect(u.pathname).toBe('/rss/search');
    expect(u.searchParams.get('q')).toBe('生成AI');
    expect(u.searchParams.get('hl')).toBe('ja');
    expect(u.searchParams.get('ceid')).toBe('JP:ja');
  });
  it('builds an en search url', () => {
    const u = new URL(googleNewsUrl('generative AI', 'en'));
    expect(u.searchParams.get('hl')).toBe('en-US');
    expect(u.searchParams.get('ceid')).toBe('US:en');
  });
});
