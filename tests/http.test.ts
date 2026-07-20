import { describe, it, expect } from 'vitest';
import { withRetry } from '../src/lib/fetch/http';

describe('withRetry', () => {
  it('returns on first success', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return 'ok'; }, 3, 1);
    expect(r).toBe('ok');
    expect(calls).toBe(1);
  });
  it('retries then succeeds', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; if (calls < 3) throw new Error('fail'); return 'ok'; }, 3, 1);
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });
  it('throws after exhausting tries', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new Error('nope'); }, 2, 1)).rejects.toThrow('nope');
    expect(calls).toBe(2);
  });
});
