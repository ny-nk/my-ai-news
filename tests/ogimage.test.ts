import { describe, it, expect } from 'vitest';
import { extractOgImage, mapWithConcurrency } from '../src/lib/fetch/ogimage';

const PAGE = 'https://example.com/news/123';

describe('extractOgImage', () => {
  it('og:image を取り出す', () => {
    const html = '<meta property="og:image" content="https://img.example.com/a.jpg">';
    expect(extractOgImage(html, PAGE)).toBe('https://img.example.com/a.jpg');
  });
  it('属性の並びが逆でも取れる', () => {
    const html = '<meta content="https://img.example.com/b.jpg" property="og:image">';
    expect(extractOgImage(html, PAGE)).toBe('https://img.example.com/b.jpg');
  });
  it('相対パスを絶対URLにする', () => {
    const html = '<meta property="og:image" content="/thumb/c.png">';
    expect(extractOgImage(html, PAGE)).toBe('https://example.com/thumb/c.png');
  });
  it('og:image が無ければ twitter:image を使う', () => {
    const html = '<meta name="twitter:image" content="https://img.example.com/t.jpg">';
    expect(extractOgImage(html, PAGE)).toBe('https://img.example.com/t.jpg');
  });
  it('data: URI は採用しない（巨大な埋め込みを持ち込まない）', () => {
    const html = '<meta property="og:image" content="data:image/png;base64,AAAA">';
    expect(extractOgImage(html, PAGE)).toBeUndefined();
  });
  it('画像が無ければ undefined', () => {
    expect(extractOgImage('<html><body>no meta</body></html>', PAGE)).toBeUndefined();
  });
});

describe('mapWithConcurrency', () => {
  it('全件処理して入力順で返す', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });
  it('同時実行数が上限を超えない', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return 0;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });
});
