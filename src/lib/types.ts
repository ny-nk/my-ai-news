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
  /** 常設カード（プラグイン等）: トリム除外・日付非表示・言語フィルタ免除 */
  pinned?: boolean;
  /** サムネイル（記事ページの og:image。取得できた記事だけ持つ） */
  image?: string;
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
