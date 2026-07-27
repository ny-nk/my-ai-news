import { describe, it, expect } from 'vitest';
import { shouldCondense } from '../src/lib/enhance';

describe('shouldCondense（操作バーの畳み判定）', () => {
  it('下方向スクロールでは畳む', () => {
    expect(shouldCondense({ y: 800, lastY: 600, busy: false })).toBe(true);
  });
  it('上方向スクロールでは展開する', () => {
    expect(shouldCondense({ y: 600, lastY: 800, busy: false })).toBe(false);
  });
  it('最上部付近では下方向でも展開したまま', () => {
    expect(shouldCondense({ y: 100, lastY: 0, busy: false })).toBe(false);
    expect(shouldCondense({ y: 159, lastY: 0, busy: false })).toBe(false);
    expect(shouldCondense({ y: 161, lastY: 0, busy: false })).toBe(true);
  });
  it('操作中（フォーカス/メニュー展開）は畳まない', () => {
    expect(shouldCondense({ y: 2000, lastY: 100, busy: true })).toBe(false);
  });
  it('同じ位置（慣性の終端など）では畳まない', () => {
    expect(shouldCondense({ y: 800, lastY: 800, busy: false })).toBe(false);
  });
});
