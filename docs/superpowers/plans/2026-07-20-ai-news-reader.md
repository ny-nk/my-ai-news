# AI News Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日英の生成AI＋IT一般ニュースをビルド時に集約し、訪問者ごとにブラウザ内で好み学習・並び替えできる公開静的サイトを作る。

**Architecture:** 2層。(1) Node/TS のビルド時パイプラインが複数ソースを取得→正規化→重複除去→ルール分類→`src/data/news.json` を出力。(2) Astro が JSON を静的HTMLに描画し、素TSのクライアント島が localStorage の好みモデルでカードを並び替え・絞り込み・👍🙅/クリック学習する。公開後のサイトは外部を叩かない。

**Tech Stack:** Astro 5（静的出力）、TypeScript、Vitest（単体テスト）、rss-parser（RSS/Atom）、tsx（TSスクリプト実行）、Node 組み込み fetch/crypto、GitHub Actions + GitHub Pages。

## Global Constraints

これらは全タスクの暗黙要件（spec 由来。値は逐語コピー）。

- **Node >= 20**（組み込み fetch / structuredClone / Astro 5 要件）。
- **静的サイトのみ**：ネットワーク取得はビルド時だけ。公開後のサイトは外部APIを呼ばない。
- **AI API・APIキーを使わない**：分類はルールベースのみ。
- **パーソナライズは各ブラウザ内（localStorage）で完結**。個人データを外部送信しない。
- **抜粋のみ**：カードはタイトル＋短い要約＋元記事リンクに留める。全文転載しない。**出典（ソース名）を必ず表示**。
- **安定ID = 正規化URLの SHA-256 ハッシュ先頭16桁**。再ビルドで id が変わってはならない（localStorage の好みが維持されるため）。
- **カテゴリはちょうど7つ**：`LLM・チャットAI` / `画像・動画・音声生成` / `研究・論文` / `プロダクト・ツール` / `ビジネス・投資・規制` / `OSS・モデル公開` / `IT一般`。
- **トリム**：直近14日 かつ 最大300件。
- **アカウント/バックエンド/DB を作らない**。
- **コミットメッセージは subject/body のみ**。`Co-Authored-By: Claude` 等の Claude 署名を一切入れない（ユーザーの全セッション共通ルール）。

---

## File Structure

作成/変更するファイルと責務（1ファイル1責務）。

| ファイル | 責務 |
|---|---|
| `package.json` / `tsconfig.json` / `astro.config.mjs` / `vitest.config.ts` | プロジェクト設定 |
| `config/sources.ts` | フィード/検索ソース定義（配列） |
| `config/taxonomy.ts` | 7カテゴリ定義＋`キーワード→カテゴリ/タグ`規則 |
| `config/scoring.ts` | スコア重み・prefs バージョン・localStorage キー |
| `src/lib/types.ts` | 型（`NewsItem`,`RawItem`,`Source`,`Rule`,`Prefs`,`ScoringConfig`,`Lang`） |
| `src/lib/normalize.ts` | URL/ID/HTML/日付 正規化 → `NewsItem`（純粋・build専用） |
| `src/lib/classify.ts` | 規則で categories/tags 付与（純粋） |
| `src/lib/dedupe.ts` | 重複除去＋トリム（純粋） |
| `src/lib/assemble.ts` | 上記を合成し `RawItem[]`→`NewsItem[]`（純粋） |
| `src/lib/fetch/http.ts` | UA/タイムアウト/リトライ付き fetch（build専用） |
| `src/lib/fetch/rss.ts` | RSS/Atom 取得＋パース |
| `src/lib/fetch/googlenews.ts` | Google News RSS URL 構築＋取得 |
| `src/lib/fetch/hackernews.ts` | HN Algolia API 取得＋整形 |
| `src/lib/fetch/index.ts` | 全ソース取得オーケストレータ（耐障害） |
| `scripts/fetch-news.ts` | パイプライン実行 → `src/data/news.json` 出力 |
| `src/data/news.json` | 生成物（seed は `[]`、リポジトリにコミット） |
| `src/lib/affinity.ts` | スコア計算・prefs 更新（純粋・client+test） |
| `src/lib/storage.ts` | localStorage 読み書き（client、store 注入可） |
| `src/lib/enhance.ts` | クライアント島：描画/フィルタ/ソート/👍🙅（glue） |
| `src/components/NewsCard.astro` | 記事カード（data-* 属性付き） |
| `src/components/ControlBar.astro` | カテゴリ/言語/検索/並び替え/リセット UI |
| `src/pages/index.astro` | JSON を描画＋クライアント島同梱 |
| `src/styles/global.css` | 最小スタイル |
| `.github/workflows/build-deploy.yml` | 定期取得→ビルド→Pages公開 |
| `README.md` | セットアップ/公開手順 |
| `tests/**/*.test.ts` | 単体テスト |

**依存の向き（循環なし）**: `types` ←（全員）／ `config/*`→`types` ／ `normalize/classify/dedupe/assemble`→`types(,config)` ／ `affinity`→`types,config` ／ `storage`→`types,config,affinity` ／ `enhance`→`affinity,storage,config,types`。**クライアントバンドルに `node:crypto` や `config/sources` を含めない**（enhance は normalize も sources も import しない）。

---

## Phase 0 — Scaffold

### Task 1: プロジェクト雛形とテスト基盤

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `src/data/news.json`, `tests/sanity.test.ts`, `src/env.d.ts`

**Interfaces:**
- Produces: `npm test`（vitest）と `npm run build`（astro）が動く土台。

- [ ] **Step 1: `package.json` を作成**

```json
{
  "name": "my-ai-news",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "fetch": "tsx scripts/fetch-news.ts",
    "update": "npm run fetch && npm run build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json` を作成**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 3: `astro.config.mjs` を作成**（base/site は環境変数で切替）

```js
import { defineConfig } from 'astro/config';

// ローカルは既定 '/'、GitHub Pages では CI が BASE_PATH='/my-ai-news/' を渡す
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  output: 'static',
  base,
  site,
});
```

- [ ] **Step 4: `vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: seed データと env 型を作成**

`src/data/news.json`:
```json
[]
```

`src/env.d.ts`:
```ts
/// <reference types="astro/client" />
```

- [ ] **Step 6: 疎通テストを作成** — `tests/sanity.test.ts`

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: 依存をインストール**

Run: `npm install`
Expected: `node_modules/` が作られ、エラーなく完了。

- [ ] **Step 8: テストを実行**

Run: `npm test`
Expected: PASS（`sanity > runs vitest`）。

- [ ] **Step 9: ビルドを実行**

Run: `npm run build`
Expected: `dist/` が生成される（ページ未作成のため空でも可、エラーが出なければOK）。

- [ ] **Step 10: コミット**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs vitest.config.ts src/data/news.json src/env.d.ts tests/sanity.test.ts
git commit -m "chore: scaffold astro + vitest project"
```

---

## Phase 1 — Types & Config

### Task 2: 型定義と設定ファイル

**Files:**
- Create: `src/lib/types.ts`, `config/taxonomy.ts`, `config/scoring.ts`, `config/sources.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces: 型と定数。`CATEGORIES`(7要素), `DEFAULT_CATEGORY`, `RULES: Rule[]`, `SCORING: ScoringConfig`, `PREFS_VERSION`, `STORAGE_KEY`, `SOURCES: Source[]`。

- [ ] **Step 1: `src/lib/types.ts` を作成**

```ts
export type Lang = 'ja' | 'en';

/** アダプタが返す正規化前の生データ */
export interface RawItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: string; // 欠損/多様な形式あり
  summary?: string;     // HTML を含み得る
  lang: Lang;
}

/** サイトで扱う正規化済みニュース */
export interface NewsItem {
  id: string;            // 正規化URLのハッシュ（安定）
  title: string;
  url: string;           // 正規化後URL
  source: string;
  publishedAt: string;   // ISO8601 / UTC（不明なら ''）
  summary: string;       // HTML除去・truncate 済（抜粋のみ）
  categories: string[];
  tags: string[];
  lang: Lang;
}

export interface Source {
  name: string;
  type: 'rss' | 'googlenews' | 'hackernews';
  lang: Lang;
  url?: string;    // rss: フィードURL
  query?: string;  // googlenews/hackernews: 検索語
}

export interface Rule {
  patterns: string[]; // title+summary に部分一致（大小無視）
  category: string;
  tags?: string[];
}

export interface Prefs {
  version: number;
  tags: Record<string, number>;
  sources: Record<string, number>;
  categories: Record<string, number>;
  hidden: string[];
  seen: string[];
}

export interface ScoringConfig {
  wRecency: number;
  wAffinity: number;
  halfLifeDays: number;
  alphaCategory: number;
  betaSource: number;
  explore: number;
  wUp: number;
  wDown: number;
  wClick: number;
}
```

- [ ] **Step 2: `config/taxonomy.ts` を作成**

```ts
import type { Rule } from '../src/lib/types';

export const CATEGORIES = [
  'LLM・チャットAI',
  '画像・動画・音声生成',
  '研究・論文',
  'プロダクト・ツール',
  'ビジネス・投資・規制',
  'OSS・モデル公開',
  'IT一般',
] as const;

export const DEFAULT_CATEGORY = 'IT一般';

/** キーワード→カテゴリ/タグ。実装後もここを育てる。 */
export const RULES: Rule[] = [
  { patterns: ['chatgpt', 'gpt-4', 'gpt-5', 'claude', 'gemini', 'llm', '大規模言語モデル', 'プロンプト', 'chatbot', 'チャットai'], category: 'LLM・チャットAI', tags: ['LLM'] },
  { patterns: ['rag', '検索拡張'], category: 'LLM・チャットAI', tags: ['RAG'] },
  { patterns: ['agent', 'エージェント', 'mcp'], category: 'LLM・チャットAI', tags: ['agent'] },
  { patterns: ['画像生成', 'stable diffusion', 'midjourney', 'dall-e', 'text-to-image', 'image generation'], category: '画像・動画・音声生成', tags: ['画像生成'] },
  { patterns: ['動画生成', 'sora', 'text-to-video', 'video generation'], category: '画像・動画・音声生成', tags: ['動画生成'] },
  { patterns: ['音声', 'text-to-speech', 'tts', 'whisper', 'speech'], category: '画像・動画・音声生成', tags: ['音声'] },
  { patterns: ['arxiv', 'paper', '論文', 'benchmark', 'ベンチマーク', 'dataset', 'データセット'], category: '研究・論文', tags: ['研究'] },
  { patterns: ['api', 'sdk', 'release', 'リリース', '新機能', 'launch', 'アップデート', 'ツール'], category: 'プロダクト・ツール', tags: ['プロダクト'] },
  { patterns: ['funding', '資金調達', '出資', 'ipo', '買収', 'acquisition', '規制', 'regulation', 'eu ai act', '政策'], category: 'ビジネス・投資・規制', tags: ['ビジネス'] },
  { patterns: ['open source', 'オープンソース', 'open-source', 'weights', 'hugging face', 'llama', 'mistral', 'qwen', 'gemma', 'モデル公開', 'apache-2.0'], category: 'OSS・モデル公開', tags: ['OSS'] },
];
```

- [ ] **Step 3: `config/scoring.ts` を作成**

```ts
import type { ScoringConfig } from '../src/lib/types';

export const PREFS_VERSION = 1;
export const STORAGE_KEY = 'my-ai-news:prefs:v1';

export const SCORING: ScoringConfig = {
  wRecency: 1,
  wAffinity: 0.5,
  halfLifeDays: 3,
  alphaCategory: 0.5,
  betaSource: 0.3,
  explore: 0.05,
  wUp: 1,
  wDown: 1,
  wClick: 0.3,
};
```

- [ ] **Step 4: `config/sources.ts` を作成**（URLは実装時に疎通確認して調整）

```ts
import type { Source } from '../src/lib/types';

// 実URLは実装時に開通確認。落ちるものは fetchAll がスキップする。
export const SOURCES: Source[] = [
  // --- 直接 RSS/Atom（英） ---
  { name: 'Hugging Face Blog', type: 'rss', lang: 'en', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'The Verge AI', type: 'rss', lang: 'en', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch AI', type: 'rss', lang: 'en', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', type: 'rss', lang: 'en', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica', type: 'rss', lang: 'en', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Simon Willison', type: 'rss', lang: 'en', url: 'https://simonwillison.net/atom/everything/' },
  // --- 直接 RSS/Atom（日） ---
  { name: 'ITmedia AI+', type: 'rss', lang: 'ja', url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml' },
  { name: 'ITmedia NEWS', type: 'rss', lang: 'ja', url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml' },
  { name: 'Publickey', type: 'rss', lang: 'ja', url: 'https://www.publickey1.jp/atom.xml' },
  { name: 'Zenn (LLM)', type: 'rss', lang: 'ja', url: 'https://zenn.dev/topics/llm/feed' },
  { name: 'Zenn (生成AI)', type: 'rss', lang: 'ja', url: 'https://zenn.dev/topics/%E7%94%9F%E6%88%90ai/feed' },
  { name: 'GIGAZINE', type: 'rss', lang: 'ja', url: 'https://gigazine.net/news/rss_2.0/' },
  // --- Google News 検索（網羅） ---
  { name: 'Google News (生成AI)', type: 'googlenews', lang: 'ja', query: '生成AI' },
  { name: 'Google News (LLM)', type: 'googlenews', lang: 'ja', query: 'LLM 生成AI' },
  { name: 'Google News (generative AI)', type: 'googlenews', lang: 'en', query: 'generative AI' },
  // --- Hacker News ---
  { name: 'Hacker News (AI)', type: 'hackernews', lang: 'en', query: 'AI OR LLM OR GPT' },
];
```

- [ ] **Step 5: 設定テストを作成** — `tests/config.test.ts`

```ts
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
```

- [ ] **Step 6: テスト実行 → 成功確認**

Run: `npm test`
Expected: PASS（config の5テスト＋sanity）。

- [ ] **Step 7: コミット**

```bash
git add src/lib/types.ts config/ tests/config.test.ts
git commit -m "feat: add types and config (categories, rules, sources, scoring)"
```

---

## Phase 2 — Pure pipeline

### Task 3: 正規化（URL/ID/HTML/日付）

**Files:**
- Create: `src/lib/normalize.ts`, `tests/normalize.test.ts`

**Interfaces:**
- Consumes: `RawItem`, `NewsItem`, `Lang`（types）。
- Produces: `normalizeUrl(raw: string): string`, `stableId(s: string): string`, `stripHtml(s: string): string`, `truncate(s: string, n?: number): string`, `toIso(input?: string): string`, `normalizeTitle(t: string): string`, `normalizeItem(raw: RawItem): NewsItem`（categories/tags は空配列で返す）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/normalize.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeUrl, stableId, stripHtml, truncate, toIso, normalizeTitle, normalizeItem,
} from '../src/lib/normalize';

describe('normalizeUrl', () => {
  it('strips utm/tracking params and hash, lowercases host', () => {
    expect(normalizeUrl('https://Example.com/a/?utm_source=x&id=5#frag'))
      .toBe('https://example.com/a/?id=5');
  });
  it('removes trailing slash except root', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe('https://example.com/a');
  });
  it('returns input on invalid url', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('stableId', () => {
  it('is deterministic and 16 hex chars', () => {
    const a = stableId('https://example.com/a');
    const b = stableId('https://example.com/a');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('stripHtml/truncate', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtml('<p>Hello&nbsp;&amp; <b>world</b></p>')).toBe('Hello & world');
  });
  it('truncates with ellipsis', () => {
    expect(truncate('abcdef', 3)).toBe('abc…');
    expect(truncate('ab', 3)).toBe('ab');
  });
});

describe('toIso', () => {
  it('parses valid dates to ISO', () => {
    expect(toIso('2026-07-20T00:00:00Z')).toBe('2026-07-20T00:00:00.000Z');
  });
  it('returns empty string on missing/invalid', () => {
    expect(toIso(undefined)).toBe('');
    expect(toIso('nonsense')).toBe('');
  });
});

describe('normalizeItem', () => {
  it('produces a NewsItem with stable id and cleaned summary', () => {
    const item = normalizeItem({
      title: '  Big News  ',
      url: 'https://Example.com/post/?utm_medium=rss',
      source: 'Example',
      publishedAt: '2026-07-20T10:00:00Z',
      summary: '<p>Some <b>summary</b></p>',
      lang: 'en',
    });
    expect(item.url).toBe('https://example.com/post');
    expect(item.id).toBe(stableId('https://example.com/post'));
    expect(item.title).toBe('Big News');
    expect(item.summary).toBe('Some summary');
    expect(item.categories).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.lang).toBe('en');
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- normalize`
Expected: FAIL（`Cannot find module '../src/lib/normalize'`）。

- [ ] **Step 3: `src/lib/normalize.ts` を実装**

```ts
import { createHash } from 'node:crypto';
import type { RawItem, NewsItem } from './types';

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|cmpid$|spm$)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (!TRACKING.test(k)) keep.append(k, v);
    u.search = keep.toString();
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function stableId(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s: string, n = 200): string {
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
}

export function toIso(input?: string): string {
  if (!input) return '';
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeItem(raw: RawItem): NewsItem {
  const url = normalizeUrl(raw.url);
  return {
    id: stableId(url),
    title: raw.title.trim(),
    url,
    source: raw.source,
    publishedAt: toIso(raw.publishedAt),
    summary: truncate(stripHtml(raw.summary ?? '')),
    categories: [],
    tags: [],
    lang: raw.lang,
  };
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- normalize`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/normalize.ts tests/normalize.test.ts
git commit -m "feat: add normalize (url/id/html/date) pipeline helpers"
```

---

### Task 4: 分類（categories/tags）

**Files:**
- Create: `src/lib/classify.ts`, `tests/classify.test.ts`

**Interfaces:**
- Consumes: `NewsItem`, `Rule`（types）、`RULES`,`DEFAULT_CATEGORY`（taxonomy）。
- Produces: `classify(item: NewsItem, rules?: Rule[]): { categories: string[]; tags: string[] }`。

- [ ] **Step 1: 失敗するテストを作成** — `tests/classify.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { classify } from '../src/lib/classify';
import type { NewsItem } from '../src/lib/types';

function item(title: string, summary = ''): NewsItem {
  return { id: 'x', title, url: 'u', source: 's', publishedAt: '', summary, categories: [], tags: [], lang: 'en' };
}

describe('classify', () => {
  it('matches multiple rules and collects tags', () => {
    const r = classify(item('New Claude LLM with RAG'));
    expect(r.categories).toContain('LLM・チャットAI');
    expect(r.tags).toEqual(expect.arrayContaining(['LLM', 'RAG']));
  });
  it('assigns image category', () => {
    const r = classify(item('Stable Diffusion 画像生成 update'));
    expect(r.categories).toContain('画像・動画・音声生成');
  });
  it('falls back to IT一般 when nothing matches', () => {
    const r = classify(item('Company reorganizes cloud division'));
    expect(r.categories).toEqual(['IT一般']);
    expect(r.tags).toEqual([]);
  });
  it('is case-insensitive and reads summary too', () => {
    const r = classify(item('Weekly digest', 'covers CHATGPT and gpt-5'));
    expect(r.categories).toContain('LLM・チャットAI');
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- classify`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/classify.ts` を実装**

```ts
import type { NewsItem, Rule } from './types';
import { RULES, DEFAULT_CATEGORY } from '../../config/taxonomy';

export function classify(item: NewsItem, rules: Rule[] = RULES): { categories: string[]; tags: string[] } {
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  const categories = new Set<string>();
  const tags = new Set<string>();
  for (const r of rules) {
    if (r.patterns.some((p) => hay.includes(p.toLowerCase()))) {
      categories.add(r.category);
      for (const t of r.tags ?? []) tags.add(t);
    }
  }
  if (categories.size === 0) categories.add(DEFAULT_CATEGORY);
  return { categories: [...categories], tags: [...tags] };
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- classify`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/classify.ts tests/classify.test.ts
git commit -m "feat: add rule-based classify (categories/tags)"
```

---

### Task 5: 重複除去とトリム

**Files:**
- Create: `src/lib/dedupe.ts`, `tests/dedupe.test.ts`

**Interfaces:**
- Consumes: `NewsItem`（types）、`normalizeTitle`（normalize）。
- Produces: `dedupe(items: NewsItem[]): NewsItem[]`（id または 正規化タイトルが既出なら除外、先勝ち）、`trim(items: NewsItem[], now: number, days?: number, max?: number): NewsItem[]`（`days` 内に絞り、新着降順、`max` 件で切る。`publishedAt===''` は除外）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/dedupe.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { dedupe, trim } from '../src/lib/dedupe';
import type { NewsItem } from '../src/lib/types';

function n(id: string, title: string, publishedAt: string): NewsItem {
  return { id, title, url: 'u' + id, source: 's', publishedAt, summary: '', categories: [], tags: [], lang: 'en' };
}
const DAY = 86400000;
const NOW = Date.parse('2026-07-20T00:00:00Z');

describe('dedupe', () => {
  it('drops duplicate ids (keeps first)', () => {
    const out = dedupe([n('a', 'One', ''), n('a', 'One again', '')]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('One');
  });
  it('drops duplicate normalized titles', () => {
    const out = dedupe([n('a', 'Same  Title', ''), n('b', 'same title', '')]);
    expect(out).toHaveLength(1);
  });
});

describe('trim', () => {
  it('keeps only items within `days`, newest first', () => {
    const items = [
      n('old', 'Old', new Date(NOW - 20 * DAY).toISOString()),
      n('new', 'New', new Date(NOW - 1 * DAY).toISOString()),
      n('mid', 'Mid', new Date(NOW - 5 * DAY).toISOString()),
    ];
    const out = trim(items, NOW, 14, 300);
    expect(out.map((i) => i.id)).toEqual(['new', 'mid']);
  });
  it('caps at max', () => {
    const items = Array.from({ length: 5 }, (_, i) => n('i' + i, 't' + i, new Date(NOW - i * 1000).toISOString()));
    expect(trim(items, NOW, 14, 3)).toHaveLength(3);
  });
  it('drops items with empty publishedAt', () => {
    expect(trim([n('x', 'No date', '')], NOW, 14, 300)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- dedupe`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/dedupe.ts` を実装**

```ts
import type { NewsItem } from './types';
import { normalizeTitle } from './normalize';

export function dedupe(items: NewsItem[]): NewsItem[] {
  const seenId = new Set<string>();
  const seenTitle = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const t = normalizeTitle(it.title);
    if (seenId.has(it.id) || (t && seenTitle.has(t))) continue;
    seenId.add(it.id);
    if (t) seenTitle.add(t);
    out.push(it);
  }
  return out;
}

export function trim(items: NewsItem[], now: number, days = 14, max = 300): NewsItem[] {
  const cutoff = now - days * 86400000;
  return items
    .filter((it) => {
      if (!it.publishedAt) return false;
      const ts = new Date(it.publishedAt).getTime();
      return !Number.isNaN(ts) && ts >= cutoff;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, max);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- dedupe`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/dedupe.ts tests/dedupe.test.ts
git commit -m "feat: add dedupe and trim"
```

---

### Task 6: 合成（RawItem[] → NewsItem[]）

**Files:**
- Create: `src/lib/assemble.ts`, `tests/assemble.test.ts`

**Interfaces:**
- Consumes: `RawItem`,`NewsItem`（types）、`normalizeItem`（normalize）、`classify`（classify）、`dedupe`,`trim`（dedupe）。
- Produces: `assembleNews(raws: RawItem[], now: number, opts?: { days?: number; max?: number }): NewsItem[]`（正規化→分類→重複除去→トリムまでを一括）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/assemble.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { assembleNews } from '../src/lib/assemble';
import type { RawItem } from '../src/lib/types';

const NOW = Date.parse('2026-07-20T00:00:00Z');
const DAY = 86400000;

function raw(title: string, url: string, ageDays: number, summary = ''): RawItem {
  return { title, url, source: 'Src', publishedAt: new Date(NOW - ageDays * DAY).toISOString(), summary, lang: 'en' };
}

describe('assembleNews', () => {
  it('normalizes, classifies, dedupes and trims', () => {
    const raws = [
      raw('Claude LLM update', 'https://a.com/1?utm_source=x', 1, 'about LLM'),
      raw('Claude LLM update', 'https://a.com/1', 1), // dup by url+title
      raw('Old news', 'https://a.com/old', 40),        // out of window
    ];
    const out = assembleNews(raws, NOW, { days: 14, max: 300 });
    expect(out).toHaveLength(1);
    expect(out[0].categories).toContain('LLM・チャットAI');
    expect(out[0].url).toBe('https://a.com/1');
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- assemble`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/assemble.ts` を実装**

```ts
import type { RawItem, NewsItem } from './types';
import { normalizeItem } from './normalize';
import { classify } from './classify';
import { dedupe, trim } from './dedupe';

export function assembleNews(
  raws: RawItem[],
  now: number,
  opts: { days?: number; max?: number } = {},
): NewsItem[] {
  const normalized = raws.map((r) => {
    const item = normalizeItem(r);
    const { categories, tags } = classify(item);
    return { ...item, categories, tags };
  });
  return trim(dedupe(normalized), now, opts.days, opts.max);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- assemble`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/assemble.ts tests/assemble.test.ts
git commit -m "feat: add assembleNews pipeline composition"
```

---

## Phase 3 — Fetch adapters

### Task 7: HTTP ヘルパ（UA/タイムアウト/リトライ）

**Files:**
- Create: `src/lib/fetch/http.ts`, `tests/http.test.ts`

**Interfaces:**
- Produces: `USER_AGENT: string`, `fetchText(url, timeoutMs?): Promise<string>`, `fetchJson<T>(url, timeoutMs?): Promise<T>`, `withRetry<T>(fn, tries?, baseDelayMs?): Promise<T>`。
- 注: `fetchText/fetchJson` は Node の `fetch` を使う（ネットワーク）。単体テストは `withRetry` のみ（純粋に近い）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/http.test.ts`

```ts
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- http`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/fetch/http.ts` を実装**

```ts
export const USER_AGENT =
  'my-ai-news/1.0 (+https://github.com/; personal AI news aggregator)';

const ACCEPT_FEED =
  'application/rss+xml, application/atom+xml, application/xml, text/xml, */*';

export async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: ACCEPT_FEED },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- http`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/fetch/http.ts tests/http.test.ts
git commit -m "feat: add http helpers (fetchText/fetchJson/withRetry)"
```

---

### Task 8: RSS/Atom アダプタ

**Files:**
- Create: `src/lib/fetch/rss.ts`, `tests/rss.test.ts`

**Interfaces:**
- Consumes: `RawItem`,`Lang`（types）、`fetchText`（http）。
- Produces: `parseRssXml(xml: string, source: string, lang: Lang): Promise<RawItem[]>`（純粋＝テスト対象）、`fetchRss(url, source, lang, fetchText?): Promise<RawItem[]>`。

- [ ] **Step 1: 失敗するテストを作成** — `tests/rss.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseRssXml } from '../src/lib/fetch/rss';

const SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Feed</title>
  <item>
    <title>Hello AI</title>
    <link>https://example.com/hello</link>
    <pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Body text</p>]]></description>
  </item>
  <item>
    <title>No link item</title>
    <description>skip me</description>
  </item>
</channel></rss>`;

describe('parseRssXml', () => {
  it('maps items and drops entries without url/title', async () => {
    const out = await parseRssXml(SAMPLE, 'Example', 'en');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: 'Hello AI', url: 'https://example.com/hello', source: 'Example', lang: 'en' });
    expect(out[0].publishedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- rss`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/fetch/rss.ts` を実装**

```ts
import Parser from 'rss-parser';
import type { RawItem, Lang } from '../types';
import { fetchText } from './http';

const parser = new Parser();

export async function parseRssXml(xml: string, source: string, lang: Lang): Promise<RawItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? [])
    .map((i) => ({
      title: (i.title ?? '').trim(),
      url: (i.link ?? '').trim(),
      source,
      publishedAt: i.isoDate ?? i.pubDate,
      summary: i.contentSnippet ?? i.content ?? '',
      lang,
    }))
    .filter((r) => r.url && r.title);
}

export async function fetchRss(
  url: string,
  source: string,
  lang: Lang,
  getText: (u: string) => Promise<string> = fetchText,
): Promise<RawItem[]> {
  const xml = await getText(url);
  return parseRssXml(xml, source, lang);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- rss`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/fetch/rss.ts tests/rss.test.ts
git commit -m "feat: add rss/atom adapter"
```

---

### Task 9: Google News アダプタ

**Files:**
- Create: `src/lib/fetch/googlenews.ts`, `tests/googlenews.test.ts`

**Interfaces:**
- Consumes: `RawItem`,`Lang`（types）、`fetchRss`（rss）。
- Produces: `googleNewsUrl(query: string, lang: Lang): string`（純粋＝テスト対象）、`fetchGoogleNews(query, lang, source?): Promise<RawItem[]>`。

- [ ] **Step 1: 失敗するテストを作成** — `tests/googlenews.test.ts`

```ts
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
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- googlenews`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/fetch/googlenews.ts` を実装**

```ts
import type { RawItem, Lang } from '../types';
import { fetchRss } from './rss';

export function googleNewsUrl(query: string, lang: Lang): string {
  const locale = lang === 'ja'
    ? { hl: 'ja', gl: 'JP', ceid: 'JP:ja' }
    : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const qs = new URLSearchParams({ q: query, ...locale });
  return `https://news.google.com/rss/search?${qs.toString()}`;
}

export async function fetchGoogleNews(query: string, lang: Lang, source = 'Google News'): Promise<RawItem[]> {
  return fetchRss(googleNewsUrl(query, lang), source, lang);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- googlenews`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/fetch/googlenews.ts tests/googlenews.test.ts
git commit -m "feat: add google news adapter"
```

---

### Task 10: Hacker News アダプタ

**Files:**
- Create: `src/lib/fetch/hackernews.ts`, `tests/hackernews.test.ts`

**Interfaces:**
- Consumes: `RawItem`（types）、`fetchJson`（http）。
- Produces: `mapAlgolia(hits: AlgoliaHit[]): RawItem[]`（純粋＝テスト対象）、`fetchHackerNews(query, getJson?): Promise<RawItem[]>`。型 `AlgoliaHit = { objectID: string; title: string | null; url: string | null; created_at: string }` を export。

- [ ] **Step 1: 失敗するテストを作成** — `tests/hackernews.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { mapAlgolia } from '../src/lib/fetch/hackernews';

describe('mapAlgolia', () => {
  it('maps hits and falls back to HN item url when url is null', () => {
    const out = mapAlgolia([
      { objectID: '1', title: 'External', url: 'https://ext.com/x', created_at: '2026-07-20T00:00:00Z' },
      { objectID: '2', title: 'Ask HN', url: null, created_at: '2026-07-20T01:00:00Z' },
      { objectID: '3', title: null, url: 'https://ext.com/y', created_at: '2026-07-20T02:00:00Z' },
    ]);
    expect(out).toHaveLength(2); // null-title dropped
    expect(out[0].url).toBe('https://ext.com/x');
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=2');
    expect(out[0].source).toBe('Hacker News');
    expect(out[0].lang).toBe('en');
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- hackernews`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/fetch/hackernews.ts` を実装**

```ts
import type { RawItem } from '../types';
import { fetchJson } from './http';

export interface AlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  created_at: string;
}

export function mapAlgolia(hits: AlgoliaHit[]): RawItem[] {
  return hits
    .filter((h) => h.title)
    .map((h) => ({
      title: h.title as string,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: 'Hacker News',
      publishedAt: h.created_at,
      summary: '',
      lang: 'en' as const,
    }));
}

export async function fetchHackerNews(
  query: string,
  getJson: <T>(u: string) => Promise<T> = fetchJson,
): Promise<RawItem[]> {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`;
  const data = await getJson<{ hits: AlgoliaHit[] }>(url);
  return mapAlgolia(data.hits ?? []);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- hackernews`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/fetch/hackernews.ts tests/hackernews.test.ts
git commit -m "feat: add hacker news adapter"
```

---

### Task 11: 取得オーケストレータ（耐障害）

**Files:**
- Create: `src/lib/fetch/index.ts`, `tests/fetch-all.test.ts`

**Interfaces:**
- Consumes: `RawItem`,`Source`（types）、各アダプタ、`withRetry`（http）。
- Produces: `fetchSource(s: Source): Promise<RawItem[]>`（型でディスパッチ）、`fetchAll(sources: Source[], run?): Promise<{ items: RawItem[]; failures: string[] }>`（1本落ちても他は返す）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/fetch-all.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { fetchAll } from '../src/lib/fetch';
import type { Source, RawItem } from '../src/lib/types';

const sources: Source[] = [
  { name: 'Good', type: 'rss', lang: 'en', url: 'x' },
  { name: 'Bad', type: 'rss', lang: 'en', url: 'y' },
];

describe('fetchAll', () => {
  it('collects successes and records failures', async () => {
    const run = async (s: Source): Promise<RawItem[]> => {
      if (s.name === 'Bad') throw new Error('boom');
      return [{ title: 't', url: 'u', source: s.name, lang: 'en' }];
    };
    const { items, failures } = await fetchAll(sources, run);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('Good');
    expect(failures).toEqual(['Bad']);
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- fetch-all`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/fetch/index.ts` を実装**

```ts
import type { RawItem, Source } from '../types';
import { fetchRss } from './rss';
import { fetchGoogleNews } from './googlenews';
import { fetchHackerNews } from './hackernews';
import { withRetry } from './http';

export async function fetchSource(s: Source): Promise<RawItem[]> {
  if (s.type === 'rss') return fetchRss(s.url as string, s.name, s.lang);
  if (s.type === 'googlenews') return fetchGoogleNews(s.query as string, s.lang, s.name);
  return fetchHackerNews(s.query as string);
}

export async function fetchAll(
  sources: Source[],
  run: (s: Source) => Promise<RawItem[]> = fetchSource,
): Promise<{ items: RawItem[]; failures: string[] }> {
  const items: RawItem[] = [];
  const failures: string[] = [];
  const results = await Promise.allSettled(sources.map((s) => withRetry(() => run(s))));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else failures.push(sources[i].name);
  });
  return { items, failures };
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- fetch-all`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/fetch/index.ts tests/fetch-all.test.ts
git commit -m "feat: add resilient fetchAll orchestrator"
```

---

## Phase 4 — Build script

### Task 12: `fetch-news.ts`（news.json 生成、keep-last-good）

**Files:**
- Create: `scripts/fetch-news.ts`

**Interfaces:**
- Consumes: `SOURCES`（config）、`fetchAll`（fetch）、`assembleNews`（assemble）。
- Produces: `src/data/news.json` を生成する実行スクリプト（`npm run fetch`）。0件時は既存を保持。

- [ ] **Step 1: `scripts/fetch-news.ts` を実装**

```ts
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SOURCES } from '../config/sources';
import { fetchAll } from '../src/lib/fetch';
import { assembleNews } from '../src/lib/assemble';

const OUT = 'src/data/news.json';

async function main() {
  const { items, failures } = await fetchAll(SOURCES);
  if (failures.length) console.warn(`[fetch] failed sources: ${failures.join(', ')}`);

  const news = assembleNews(items, Date.now(), { days: 14, max: 300 });

  if (news.length === 0) {
    console.error('[fetch] assembled 0 items — keeping previous news.json (not overwriting)');
    if (!existsSync(OUT)) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, '[]\n');
    }
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(news, null, 2) + '\n');
  console.log(`[fetch] wrote ${news.length} items to ${OUT} (failures: ${failures.length})`);
}

main().catch((e) => {
  console.error('[fetch] fatal:', e);
  process.exit(1);
});
```

- [ ] **Step 2: 実際に取得して動作確認**（ネットワーク必要）

Run: `npm run fetch`
Expected: `[fetch] wrote N items to src/data/news.json`（N>0）。一部ソースは `failed sources:` に出てもよい（耐障害）。

- [ ] **Step 3: 生成物を目視確認**

Run: `node -e "const a=require('./src/data/news.json'); console.log(a.length, a[0])"`
Expected: 件数と先頭要素（id, title, url, source, publishedAt, categories, tags, lang）が表示される。

- [ ] **Step 4: 全テスト再実行（回帰確認）**

Run: `npm test`
Expected: 既存テスト全て PASS。

- [ ] **Step 5: コミット**

```bash
git add scripts/fetch-news.ts src/data/news.json
git commit -m "feat: add fetch-news script and initial news.json"
```

---

## Phase 5 — Personalization logic

### Task 13: 好みスコア（affinity）

**Files:**
- Create: `src/lib/affinity.ts`, `tests/affinity.test.ts`

**Interfaces:**
- Consumes: `NewsItem`,`Prefs`,`ScoringConfig`（types）、`PREFS_VERSION`（scoring）。
- Produces: `emptyPrefs(): Prefs`、`computeScore(item, prefs, cfg, now, rand?): number`、`updatePrefs(prefs, item, signal: 'up'|'down'|'click', cfg): Prefs`（新オブジェクトを返す・非破壊）。

- [ ] **Step 1: 失敗するテストを作成** — `tests/affinity.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { emptyPrefs, computeScore, updatePrefs } from '../src/lib/affinity';
import { SCORING } from '../config/scoring';
import type { NewsItem } from '../src/lib/types';

const NOW = Date.parse('2026-07-20T00:00:00Z');
const DAY = 86400000;
function item(over: Partial<NewsItem> = {}): NewsItem {
  return { id: 'a', title: 't', url: 'u', source: 'Src', publishedAt: new Date(NOW).toISOString(),
    summary: '', categories: ['LLM・チャットAI'], tags: ['LLM'], lang: 'en', ...over };
}
const noExplore = { ...SCORING, explore: 0 };
const zeroRand = () => 0;

describe('emptyPrefs', () => {
  it('starts empty with version', () => {
    const p = emptyPrefs();
    expect(p.hidden).toEqual([]);
    expect(p.version).toBeGreaterThan(0);
  });
});

describe('computeScore', () => {
  it('fresh item scores higher than old (recency)', () => {
    const fresh = computeScore(item(), emptyPrefs(), noExplore, NOW, zeroRand);
    const old = computeScore(item({ publishedAt: new Date(NOW - 6 * DAY).toISOString() }), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(fresh).toBeGreaterThan(old);
  });
  it('positive tag affinity raises score', () => {
    const p = emptyPrefs(); p.tags['LLM'] = 5;
    const liked = computeScore(item(), p, noExplore, NOW, zeroRand);
    const neutral = computeScore(item(), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(liked).toBeGreaterThan(neutral);
  });
  it('empty publishedAt gives zero recency', () => {
    const s = computeScore(item({ publishedAt: '' }), emptyPrefs(), noExplore, NOW, zeroRand);
    expect(s).toBe(0);
  });
});

describe('updatePrefs', () => {
  it('up increases tag/category/source weights, non-mutating', () => {
    const p0 = emptyPrefs();
    const p1 = updatePrefs(p0, item(), 'up', SCORING);
    expect(p1.tags['LLM']).toBe(SCORING.wUp);
    expect(p1.categories['LLM・チャットAI']).toBe(SCORING.wUp);
    expect(p1.sources['Src']).toBe(SCORING.wUp);
    expect(p0.tags['LLM']).toBeUndefined(); // original untouched
  });
  it('down decreases weights and hides the item', () => {
    const p = updatePrefs(emptyPrefs(), item(), 'down', SCORING);
    expect(p.tags['LLM']).toBe(-SCORING.wDown);
    expect(p.hidden).toContain('a');
  });
  it('click adds small weight and marks seen', () => {
    const p = updatePrefs(emptyPrefs(), item(), 'click', SCORING);
    expect(p.tags['LLM']).toBe(SCORING.wClick);
    expect(p.seen).toContain('a');
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- affinity`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/affinity.ts` を実装**

```ts
import type { NewsItem, Prefs, ScoringConfig } from './types';
import { PREFS_VERSION } from '../../config/scoring';

export function emptyPrefs(): Prefs {
  return { version: PREFS_VERSION, tags: {}, sources: {}, categories: {}, hidden: [], seen: [] };
}

function ageDays(iso: string, now: number): number {
  return Math.max(0, (now - new Date(iso).getTime()) / 86400000);
}

export function computeScore(
  item: NewsItem,
  prefs: Prefs,
  cfg: ScoringConfig,
  now: number,
  rand: () => number = Math.random,
): number {
  const recency = item.publishedAt ? Math.pow(0.5, ageDays(item.publishedAt, now) / cfg.halfLifeDays) : 0;
  let aff = 0;
  for (const t of item.tags) aff += prefs.tags[t] ?? 0;
  for (const c of item.categories) aff += cfg.alphaCategory * (prefs.categories[c] ?? 0);
  aff += cfg.betaSource * (prefs.sources[item.source] ?? 0);
  const explore = rand() * cfg.explore;
  return cfg.wRecency * recency + cfg.wAffinity * aff + explore;
}

export function updatePrefs(
  prefs: Prefs,
  item: NewsItem,
  signal: 'up' | 'down' | 'click',
  cfg: ScoringConfig,
): Prefs {
  const p: Prefs = structuredClone(prefs);
  const delta = signal === 'up' ? cfg.wUp : signal === 'down' ? -cfg.wDown : cfg.wClick;
  for (const t of item.tags) p.tags[t] = (p.tags[t] ?? 0) + delta;
  for (const c of item.categories) p.categories[c] = (p.categories[c] ?? 0) + delta;
  p.sources[item.source] = (p.sources[item.source] ?? 0) + delta;
  if (signal === 'down' && !p.hidden.includes(item.id)) p.hidden.push(item.id);
  if (signal === 'click' && !p.seen.includes(item.id)) p.seen.push(item.id);
  return p;
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- affinity`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/affinity.ts tests/affinity.test.ts
git commit -m "feat: add affinity scoring and prefs update"
```

---

### Task 14: localStorage 永続化（storage）

**Files:**
- Create: `src/lib/storage.ts`, `tests/storage.test.ts`

**Interfaces:**
- Consumes: `Prefs`（types）、`emptyPrefs`（affinity）、`PREFS_VERSION`,`STORAGE_KEY`（scoring）。
- Produces: `StorageLike` 型（`getItem/setItem/removeItem`）、`loadPrefs(store?): Prefs`、`savePrefs(prefs, store?): void`、`resetPrefs(store?): void`。`store` 既定は `globalThis.localStorage`。壊れた/版違いは `emptyPrefs()`。

- [ ] **Step 1: 失敗するテストを作成** — `tests/storage.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { loadPrefs, savePrefs, resetPrefs, type StorageLike } from '../src/lib/storage';
import { emptyPrefs } from '../src/lib/affinity';
import { STORAGE_KEY, PREFS_VERSION } from '../config/scoring';

function fakeStore(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('storage', () => {
  it('returns emptyPrefs when nothing stored', () => {
    expect(loadPrefs(fakeStore())).toEqual(emptyPrefs());
  });
  it('round-trips prefs', () => {
    const store = fakeStore();
    const p = emptyPrefs(); p.tags['LLM'] = 3;
    savePrefs(p, store);
    expect(loadPrefs(store).tags['LLM']).toBe(3);
  });
  it('returns emptyPrefs on corrupt json', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('returns emptyPrefs on version mismatch', () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ ...emptyPrefs(), version: PREFS_VERSION + 1 }));
    expect(loadPrefs(store)).toEqual(emptyPrefs());
  });
  it('reset clears prefs', () => {
    const store = fakeStore();
    savePrefs(emptyPrefs(), store);
    resetPrefs(store);
    expect(store.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npm test -- storage`
Expected: FAIL（module 不明）。

- [ ] **Step 3: `src/lib/storage.ts` を実装**

```ts
import type { Prefs } from './types';
import { emptyPrefs } from './affinity';
import { STORAGE_KEY, PREFS_VERSION } from '../../config/scoring';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadPrefs(store: StorageLike = globalThis.localStorage): Prefs {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return emptyPrefs();
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    if (parsed?.version !== PREFS_VERSION) return emptyPrefs();
    return { ...emptyPrefs(), ...parsed } as Prefs;
  } catch {
    return emptyPrefs();
  }
}

export function savePrefs(prefs: Prefs, store: StorageLike = globalThis.localStorage): void {
  store.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function resetPrefs(store: StorageLike = globalThis.localStorage): void {
  store.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: 実行して成功を確認**

Run: `npm test -- storage`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/storage.ts tests/storage.test.ts
git commit -m "feat: add localStorage prefs persistence"
```

---

## Phase 6 — Frontend

### Task 15: スタイルとカードコンポーネント

**Files:**
- Create: `src/styles/global.css`, `src/components/NewsCard.astro`

**Interfaces:**
- Consumes: `NewsItem`（types）。
- Produces: `<NewsCard item={NewsItem} />`。ルート要素 `article.news-card` に `data-id/data-categories/data-tags/data-source/data-lang/data-published`、`.title`（元記事リンク）、`.summary`、`.like`/`.hide` ボタンを持つ（enhance がこれらを参照）。

- [ ] **Step 1: `src/styles/global.css` を作成**

```css
:root { color-scheme: light dark; --fg: #1a1a1a; --muted: #666; --bg: #fff; --card: #f7f7f8; --accent: #3b6ea5; --border: #e2e2e5; }
@media (prefers-color-scheme: dark) { :root { --fg: #e8e8ea; --muted: #a0a0a8; --bg: #16171a; --card: #1f2024; --accent: #6ea3d8; --border: #2c2d32; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
.wrap { max-width: 860px; margin: 0 auto; padding: 1rem; }
header h1 { font-size: 1.4rem; margin: 0.2rem 0; }
.sub { color: var(--muted); font-size: 0.85rem; }
.controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0; }
.chips-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.cat-chip input { display: none; }
.cat-chip { border: 1px solid var(--border); border-radius: 999px; padding: 0.2rem 0.7rem; font-size: 0.8rem; cursor: pointer; user-select: none; }
.cat-chip:has(input:checked) { background: var(--accent); color: #fff; border-color: var(--accent); }
input[type="search"], select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--fg); }
button { cursor: pointer; }
.feed { display: flex; flex-direction: column; gap: 0.75rem; list-style: none; padding: 0; margin: 0; }
.news-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 0.9rem 1rem; }
.news-card .title { font-weight: 600; color: var(--fg); text-decoration: none; font-size: 1.05rem; }
.news-card .title:hover { color: var(--accent); text-decoration: underline; }
.news-card .meta { color: var(--muted); font-size: 0.8rem; display: flex; gap: 0.6rem; margin: 0.3rem 0; }
.news-card .summary { margin: 0.4rem 0; font-size: 0.92rem; }
.news-card .taglist { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
.news-card .chip, .news-card .tag { font-size: 0.72rem; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 0.05rem 0.4rem; }
.actions { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
.actions button { border: 1px solid var(--border); background: var(--bg); border-radius: 8px; padding: 0.2rem 0.6rem; font-size: 0.95rem; }
#empty { color: var(--muted); text-align: center; padding: 2rem 0; }
[hidden] { display: none !important; }
```

- [ ] **Step 2: `src/components/NewsCard.astro` を作成**

```astro
---
import type { NewsItem } from '../lib/types';
interface Props { item: NewsItem }
const { item } = Astro.props;
const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ja-JP') : '';
---
<article
  class="news-card"
  data-id={item.id}
  data-categories={item.categories.join('|')}
  data-tags={item.tags.join('|')}
  data-source={item.source}
  data-lang={item.lang}
  data-published={item.publishedAt}
>
  <a class="title" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
  <div class="meta">
    <span class="source">{item.source}</span>
    {date && <time datetime={item.publishedAt}>{date}</time>}
  </div>
  {item.summary && <p class="summary">{item.summary}</p>}
  <div class="taglist">
    {item.categories.map((c) => <span class="chip">{c}</span>)}
    {item.tags.map((t) => <span class="tag">#{t}</span>)}
  </div>
  <div class="actions">
    <button class="like" type="button" aria-label="興味あり">👍</button>
    <button class="hide" type="button" aria-label="非表示にする">🙅</button>
  </div>
</article>
```

- [ ] **Step 3: コミット**

```bash
git add src/styles/global.css src/components/NewsCard.astro
git commit -m "feat: add styles and NewsCard component"
```

---

### Task 16: コントロールバーとページ（静的描画）

**Files:**
- Create: `src/components/ControlBar.astro`, `src/pages/index.astro`

**Interfaces:**
- Consumes: `CATEGORIES`（taxonomy）、`NewsCard`、`news.json`。
- Produces: `#feed`（カード親）、`#empty`（空状態）、コントロール群（`.cat-chip` 各カテゴリ、`#lang`,`#search`,`#sort`,`#reset`）。enhance がこれらの id/クラスを参照。

- [ ] **Step 1: `src/components/ControlBar.astro` を作成**

```astro
---
interface Props { categories: readonly string[] }
const { categories } = Astro.props;
---
<div class="controls">
  <div class="chips-row">
    {categories.map((c) => (
      <label class="cat-chip"><input type="checkbox" class="cat-chip-input" value={c} />{c}</label>
    ))}
  </div>
  <select id="lang" aria-label="言語">
    <option value="all">言語: すべて</option>
    <option value="ja">日本語</option>
    <option value="en">英語</option>
  </select>
  <select id="sort" aria-label="並び替え">
    <option value="affinity">好み順</option>
    <option value="recent">新着順</option>
  </select>
  <input id="search" type="search" placeholder="キーワード検索" aria-label="検索" />
  <button id="reset" type="button">学習をリセット</button>
</div>
```

> 注: `ControlBar` は checkbox の class を `cat-chip-input` にしている。enhance はこの class で購読する（`.cat-chip` はラベル側）。

- [ ] **Step 2: `src/pages/index.astro` を作成**

```astro
---
import '../styles/global.css';
import NewsCard from '../components/NewsCard.astro';
import ControlBar from '../components/ControlBar.astro';
import { CATEGORIES } from '../../config/taxonomy';
import type { NewsItem } from '../lib/types';
import newsData from '../data/news.json';

const items = (newsData as NewsItem[])
  .slice()
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
const lastUpdated = items[0]?.publishedAt ? new Date(items[0].publishedAt).toLocaleString('ja-JP') : '—';
---
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My AI News</title>
    <meta name="description" content="生成AI＋IT一般ニュースを好みに合わせて読むリーダー" />
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>My AI News</h1>
        <p class="sub">
          生成AI＋IT一般の最新ニュース ・ {items.length}件 ・ 最終更新 {lastUpdated}<br />
          好みの学習はこの端末内（localStorage）だけで完結し、外部に送信されません。
        </p>
      </header>

      <ControlBar categories={CATEGORIES} />

      <ul class="feed" id="feed">
        {items.map((item) => <li><NewsCard item={item} /></li>)}
      </ul>
      <p id="empty" hidden>該当する記事がありません。</p>
    </div>

    <script>
      import { initEnhance } from '../lib/enhance';
      initEnhance();
    </script>
  </body>
</html>
```

> 注: `NewsCard` を `<li>` で包むので、enhance は `.news-card` の親 `<li>` を並び替え/非表示の単位にする（Task 17 で対応）。

- [ ] **Step 3: ビルドしてカードが静的HTMLに出ることを確認**

Run: `npm run build`
Expected: 成功。`dist/index.html` に記事タイトルが含まれる。

Run: `node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');console.log('cards:', (h.match(/news-card/g)||[]).length)"`
Expected: `cards:` が 1 以上（news.json の件数に依存）。

- [ ] **Step 4: コミット**

```bash
git add src/components/ControlBar.astro src/pages/index.astro
git commit -m "feat: add control bar and index page (static render)"
```

---

### Task 17: クライアント島（enhance）

**Files:**
- Create: `src/lib/enhance.ts`

**Interfaces:**
- Consumes: `loadPrefs/savePrefs/resetPrefs`（storage）、`computeScore/updatePrefs/emptyPrefs`（affinity）、`SCORING`（scoring）、`NewsItem`（types）。
- Produces: `initEnhance(): void`（`index.astro` の `<script>` から呼ばれる）。`.news-card` を読み、`<li>`（親）単位で並び替え/非表示。`.cat-chip-input`,`#lang`,`#search`,`#sort`,`#reset`,`.like`,`.hide`,`.title` を購読。

- [ ] **Step 1: `src/lib/enhance.ts` を実装**

```ts
import { loadPrefs, savePrefs, resetPrefs } from './storage';
import { computeScore, updatePrefs, emptyPrefs } from './affinity';
import { SCORING } from '../../config/scoring';
import type { NewsItem, Prefs, Lang } from './types';

interface CardRef {
  unit: HTMLElement; // 並び替え/非表示の単位（<li> か .news-card）
  item: NewsItem;
}

function parseCard(el: HTMLElement): NewsItem {
  const titleEl = el.querySelector<HTMLAnchorElement>('.title');
  const split = (s: string | undefined) => (s ?? '').split('|').filter(Boolean);
  return {
    id: el.dataset.id ?? '',
    title: titleEl?.textContent?.trim() ?? '',
    url: titleEl?.href ?? '',
    source: el.dataset.source ?? '',
    publishedAt: el.dataset.published ?? '',
    summary: el.querySelector('.summary')?.textContent ?? '',
    categories: split(el.dataset.categories),
    tags: split(el.dataset.tags),
    lang: (el.dataset.lang as Lang) ?? 'en',
  };
}

export function initEnhance(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const cards: CardRef[] = [...feed.querySelectorAll<HTMLElement>('.news-card')].map((el) => ({
    unit: (el.closest('li') as HTMLElement) ?? el,
    item: parseCard(el),
  }));

  let prefs: Prefs = loadPrefs();
  const state = {
    cats: new Set<string>(),
    lang: 'all' as 'all' | Lang,
    query: '',
    sort: 'affinity' as 'affinity' | 'recent',
  };
  const now = Date.now();

  const visible = (c: CardRef): boolean => {
    if (prefs.hidden.includes(c.item.id)) return false;
    if (state.cats.size && !c.item.categories.some((x) => state.cats.has(x))) return false;
    if (state.lang !== 'all' && c.item.lang !== state.lang) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = `${c.item.title} ${c.item.summary} ${c.item.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const render = (): void => {
    const shown = cards.filter(visible);
    shown.sort((a, b) =>
      state.sort === 'recent'
        ? new Date(b.item.publishedAt).getTime() - new Date(a.item.publishedAt).getTime()
        : computeScore(b.item, prefs, SCORING, now) - computeScore(a.item, prefs, SCORING, now),
    );
    for (const c of cards) c.unit.hidden = true;
    for (const c of shown) {
      c.unit.hidden = false;
      feed.appendChild(c.unit);
    }
    const empty = document.getElementById('empty');
    if (empty) empty.hidden = shown.length !== 0;
  };

  // 記事内アクション（イベント委譲）
  feed.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('.news-card');
    if (!cardEl) return;
    const ref = cards.find((c) => c.unit.contains(cardEl));
    if (!ref) return;
    if (target.closest('.like')) {
      prefs = updatePrefs(prefs, ref.item, 'up', SCORING);
      savePrefs(prefs);
      render();
    } else if (target.closest('.hide')) {
      prefs = updatePrefs(prefs, ref.item, 'down', SCORING);
      savePrefs(prefs);
      render();
    } else if (target.closest('.title')) {
      prefs = updatePrefs(prefs, ref.item, 'click', SCORING);
      savePrefs(prefs); // 遷移はそのまま許可（re-render しない）
    }
  });

  // コントロールバー
  document.querySelectorAll<HTMLInputElement>('.cat-chip-input').forEach((chip) => {
    chip.addEventListener('change', () => {
      if (chip.checked) state.cats.add(chip.value);
      else state.cats.delete(chip.value);
      render();
    });
  });
  const langSel = document.getElementById('lang') as HTMLSelectElement | null;
  langSel?.addEventListener('change', () => {
    state.lang = langSel.value as 'all' | Lang;
    render();
  });
  const search = document.getElementById('search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  const sortSel = document.getElementById('sort') as HTMLSelectElement | null;
  sortSel?.addEventListener('change', () => {
    state.sort = sortSel.value as 'affinity' | 'recent';
    render();
  });
  document.getElementById('reset')?.addEventListener('click', () => {
    resetPrefs();
    prefs = emptyPrefs();
    render();
  });

  render();
}
```

- [ ] **Step 2: ビルドが通ることを確認（型・バンドル）**

Run: `npm run build`
Expected: 成功（enhance とその依存がクライアント用にバンドルされる）。エラーが出たら型/インポートを修正。

- [ ] **Step 3: 手動動作確認**（開発サーバ）

Run: `npm run dev` → ブラウザで `http://localhost:4321/` を開く。
確認:
1. カードが新着順に並ぶ（初回 prefs 空 → recency 支配）。
2. カテゴリチップを ON にすると絞り込まれる。言語・検索・並び替えが効く。
3. あるカードで 👍 → 同じソース/タグの記事が上位化（好み順時）。
4. 🙅 → そのカードが消える。
5. リロードしても 3〜4 の効果が残る（localStorage 永続）。
6. 「学習をリセット」→ 元の新着順に戻る。
7. DevTools → Application → Local Storage に `my-ai-news:prefs:v1` が入る。

- [ ] **Step 4: コミット**

```bash
git add src/lib/enhance.ts
git commit -m "feat: add client enhancement (filter/sort/feedback/persist)"
```

---

## Phase 7 — Deploy

### Task 18: GitHub Actions（定期取得→ビルド→Pages）と README

**Files:**
- Create: `.github/workflows/build-deploy.yml`, `README.md`

**Interfaces:**
- Produces: cron/手動起動のワークフロー。`news.json` に差分があればコミット、`BASE_PATH`/`SITE_URL` を渡してビルド、Pages へ deploy。

- [ ] **Step 1: `.github/workflows/build-deploy.yml` を作成**

```yaml
name: Build and deploy

on:
  schedule:
    - cron: '0 22 * * *'   # 毎日 22:00 UTC ≒ 翌 07:00 JST（頻度は好みで調整）
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: write   # news.json のコミット用
  pages: write
  id-token: write

concurrency:
  group: build-deploy
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Fetch news
        run: npm run fetch

      - name: Commit updated news.json
        run: |
          if ! git diff --quiet -- src/data/news.json; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add src/data/news.json
            git commit -m "chore: update news.json"
            git push
          else
            echo "news.json unchanged"
          fi

      - name: Build
        run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
          SITE_URL: https://${{ github.repository_owner }}.github.io

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> 注: 上の commit ステップは `news.json` が変わった時だけ push する。これにより履歴が残り、Actions の「60日非活性で自動停止」も回避できる。CI の commit は github-actions bot 名義（あなたの個人設定とは別）。

- [ ] **Step 2: `README.md` を作成**

````markdown
# My AI News

日英の生成AI＋IT一般ニュースを集約し、訪問者ごとにブラウザ内で好みを学習して並び替える公開静的サイト。

- サーバ/DB/ログイン不要。ネットワーク取得はビルド時のみ。
- 好みの学習は各端末の localStorage だけで完結し、外部送信しない。
- 記事はタイトル＋短い抜粋＋元記事リンクのみ（出典明記）。

## 開発

```bash
npm install
npm run fetch     # ニュース取得 → src/data/news.json
npm run dev       # http://localhost:4321/
npm test          # 単体テスト
npm run update    # fetch + build（ワンショット更新）
```

## 公開（GitHub Pages）

1. GitHub にリポジトリを作成して push。
2. Settings → Pages → Build and deployment → Source = **GitHub Actions**。
3. `.github/workflows/build-deploy.yml` が cron（既定: 毎日）と手動（Actions → Run workflow）で取得→ビルド→公開する。
4. 公開URL: `https://<user>.github.io/<repo>/`（`BASE_PATH` はワークフローがリポジトリ名から自動設定）。

## 好みの調整

- ソース: `config/sources.ts`
- カテゴリと分類規則: `config/taxonomy.ts`
- スコア重み: `config/scoring.ts`
````

- [ ] **Step 3: 最終確認（全テスト＋ビルド）**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功。

- [ ] **Step 4: コミット**

```bash
git add .github/workflows/build-deploy.yml README.md
git commit -m "ci: add scheduled build/deploy workflow and README"
```

- [ ] **Step 5: 公開（手動オペレーション）**

1. GitHub で空リポジトリ `my-ai-news` を作成。
2. `git remote add origin <URL>` → `git push -u origin main`。
3. Settings → Pages → Source = GitHub Actions。
4. Actions タブでワークフローを手動実行し、公開URLを確認。

---

## Self-Review

**1. Spec coverage（spec §→タスク対応）:**
- §4 アーキ2層 → Phase 2–4（パイプライン）＋Phase 6（フロント）
- §5.1 ソース3種 → Task 2(config)/8/9/10/11
- §5.2 7カテゴリ → Task 2（config.test で7件検証）
- §5.3 ルール分類 → Task 4
- §5.4 URL正規化・安定ID・重複除去 → Task 3/5
- §5.5 出力スキーマ・トリム → Task 3(types)/5/6/12
- §5.6 堅牢性・keep-last-good・UA → Task 7/11/12
- §6 UI・data属性・プログレッシブエンハンスメント → Task 15/16/17
- §7 好みモデル・スコア式・探索枠・透明性/リセット → Task 13/14/17
- §8 更新・公開（cron/Pages/news.jsonコミット）→ Task 18
- §9 テスト → 各タスクに単体テスト
- §10 エラーハンドリング → Task 7/11/12/14/17
- §13 抜粋のみ・出典明記 → Task 3(truncate)/15(NewsCard)
- ギャップ: なし（探索枠 explore は Task 13 の computeScore に実装済）。

**2. Placeholder scan:** `TBD`/`後で`/未記載コード無し。config のフィードURLは実値を記載済（実装時に疎通確認する運用は spec §14 由来で、計画上のプレースホルダではない）。

**3. Type consistency:** `RawItem/NewsItem/Source/Rule/Prefs/ScoringConfig`（Task 2）を全タスクで一致利用。`computeScore/updatePrefs/emptyPrefs/loadPrefs/savePrefs/resetPrefs/assembleNews/fetchAll/classify/dedupe/trim/normalizeItem` のシグネチャは produces/consumes 間で一致。`.cat-chip-input`（購読）と `.cat-chip`（ラベル）を Task 16 の注記で明確化し enhance と整合。カード並び替え単位は `<li>`（Task 16→17 注記で整合）。

以上、追加修正なし。
