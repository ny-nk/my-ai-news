import { describe, it, expect } from 'vitest';
import { googleNewsUrl, extractPublisher } from '../src/lib/fetch/googlenews';
import type { RawItem } from '../src/lib/types';

function raw(title: string): RawItem {
  return { title, url: 'https://news.google.com/rss/articles/x', source: 'Google News (生成AI)', lang: 'ja' };
}

describe('extractPublisher', () => {
  it('moves the trailing publisher into source and strips it from the title', () => {
    const out = extractPublisher(raw('生成AIの新機能が発表 - 日本経済新聞'));
    expect(out.source).toBe('日本経済新聞');
    expect(out.title).toBe('生成AIの新機能が発表');
  });
  it('splits on the LAST separator when the title itself contains " - "', () => {
    const out = extractPublisher(raw('GPT-5 - the next step - TechCrunch'));
    expect(out.source).toBe('TechCrunch');
    expect(out.title).toBe('GPT-5 - the next step');
  });
  it('leaves items without a separator untouched', () => {
    const out = extractPublisher(raw('セパレータのないタイトル'));
    expect(out.source).toBe('Google News (生成AI)');
    expect(out.title).toBe('セパレータのないタイトル');
  });
  it('keeps the original source when the suffix is implausibly long', () => {
    const long = 'x'.repeat(80);
    const out = extractPublisher(raw(`本文タイトル - ${long}`));
    expect(out.source).toBe('Google News (生成AI)');
  });
});

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
