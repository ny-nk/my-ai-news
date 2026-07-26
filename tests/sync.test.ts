import { describe, it, expect } from 'vitest';
import { buildSyncUrl, readSyncedPrefs, syncablePrefs, SYNC_PARAM } from '../src/lib/sync';
import { emptyPrefs } from '../src/lib/affinity';

const BASE = 'https://example.com/my-tech-news/';

function samplePrefs() {
  const p = emptyPrefs();
  p.tags['LLM'] = 2.5;
  p.sources['ITmedia AI+'] = -1;
  p.categories['研究・論文'] = 0.5;
  p.hidden.push('abc1234567890def');
  p.seen.push('should-not-travel');
  return p;
}

describe('syncablePrefs', () => {
  it('drops seen (unused by scoring, keeps the URL short)', () => {
    expect(syncablePrefs(samplePrefs()).seen).toEqual([]);
  });
});

describe('sync url round-trip', () => {
  it('carries weights and hidden through the hash', async () => {
    const url = await buildSyncUrl(samplePrefs(), BASE);
    const restored = await readSyncedPrefs(new URL(url).hash);
    expect(restored).not.toBeNull();
    expect(restored!.tags['LLM']).toBe(2.5);
    expect(restored!.sources['ITmedia AI+']).toBe(-1);
    expect(restored!.categories['研究・論文']).toBe(0.5);
    expect(restored!.hidden).toEqual(['abc1234567890def']);
    expect(restored!.seen).toEqual([]);
  });

  it('puts the payload in the hash, not the query (never sent to the server)', async () => {
    const url = new URL(await buildSyncUrl(samplePrefs(), BASE));
    expect(url.hash.startsWith(`#${SYNC_PARAM}=`)).toBe(true);
    expect(url.search).toBe('');
  });

  it('stays compact enough to paste (typical prefs)', async () => {
    const url = await buildSyncUrl(samplePrefs(), BASE);
    expect(url.length).toBeLessThan(500);
  });

  it('returns undefined when the hash has no payload', async () => {
    expect(await readSyncedPrefs('')).toBeUndefined();
    expect(await readSyncedPrefs('#somethingelse=1')).toBeUndefined();
  });

  it('returns null for a corrupt payload', async () => {
    expect(await readSyncedPrefs(`#${SYNC_PARAM}=not-real-deflate-data`)).toBeNull();
  });
});
