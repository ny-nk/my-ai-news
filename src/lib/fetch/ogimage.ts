import { USER_AGENT } from './http';

/** og:image を HTML から抜き出す（属性の並び順が逆のケースにも対応）。 */
export function extractOgImage(html: string, pageUrl: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (!m?.[1]) continue;
    const raw = m[1].trim();
    if (!raw || raw.startsWith('data:')) continue;
    try {
      const abs = new URL(raw, pageUrl); // 相対パスを絶対化
      if (abs.protocol !== 'https:' && abs.protocol !== 'http:') continue;
      return abs.toString();
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * 記事ページの先頭だけ読んで og:image を取る。
 * 全文は要らないので、og:image が見つかるか上限に達したら読み止める
 * （相手サーバへの負荷とビルド時間をどちらも抑える）。
 */
export async function fetchOgImage(url: string, timeoutMs = 8000, maxBytes = 80000): Promise<string | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!res.ok || !res.body) return undefined;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return undefined;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let read = 0;
    while (read < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.length;
      html += decoder.decode(value, { stream: true });
      if (html.includes('og:image')) break; // 目的のタグに届いたら十分
    }
    void reader.cancel().catch(() => undefined);
    return extractOgImage(html, res.url || url);
  } catch {
    return undefined; // 取れなくてもサムネなしで表示するだけ
  } finally {
    clearTimeout(timer);
  }
}

/** 同時実行数を絞って順に処理する（相手サイトへの配慮 + メモリ節約）。 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
