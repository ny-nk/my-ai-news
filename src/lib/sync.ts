import type { Prefs } from './types';
import { parsePrefsBackup } from './storage';

/**
 * 端末間で好みを移す URL の組み立て/読み取り。
 * ペイロードは URL のハッシュに置くので、サーバへは送信されない。
 *
 * `seen` と `viewed` は同期しない（端末ごとの閲覧履歴であり、URL を無駄に長くするだけ）。
 */
export const SYNC_PARAM = 'p';

/** deflate-raw + base64url。ブラウザと Node のどちらでも動くよう最小限の API だけ使う。 */
async function deflateToBase64Url(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function inflateFromBase64Url(payload: string): Promise<string> {
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** 同期用に持ち出す分だけ抜き出す（seen / viewed は落とす）。 */
export function syncablePrefs(prefs: Prefs): Prefs {
  return { ...prefs, seen: [], viewed: [] };
}

/** 現在の好みを埋め込んだ同期用 URL を作る。 */
export async function buildSyncUrl(prefs: Prefs, baseUrl: string): Promise<string> {
  const payload = await deflateToBase64Url(JSON.stringify(syncablePrefs(prefs)));
  const url = new URL(baseUrl);
  url.hash = `${SYNC_PARAM}=${payload}`;
  return url.toString();
}

/**
 * URL のハッシュから好みを取り出す。
 * 同期ペイロードが無ければ undefined、壊れていれば null を返す。
 */
export async function readSyncedPrefs(hash: string): Promise<Prefs | null | undefined> {
  const m = new RegExp(`(?:^#?|&)${SYNC_PARAM}=([A-Za-z0-9\\-_]+)`).exec(hash);
  if (!m) return undefined;
  try {
    return parsePrefsBackup(await inflateFromBase64Url(m[1]));
  } catch {
    return null;
  }
}
