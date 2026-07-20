import { stableId } from '../src/lib/normalize';
import { PLUGIN_CATEGORY } from './taxonomy';
import type { NewsItem, Lang } from '../src/lib/types';

export interface Plugin {
  name: string;
  url: string; // クリック先（marketplace / repo / 個別ページ）
  source: string; // マーケットプレイス名
  summary: string; // 日本語の説明（抜粋）
  tags?: string[];
  lang?: Lang;
}

/**
 * 厳選 Claude Code プラグイン（静的キュレーション）。
 * ここを編集して増減する。自動取得はしない（常設情報のため）。
 */
export const PLUGINS: Plugin[] = [
  // --- 公式 claude-plugins-official ---
  { name: 'frontend-design', url: 'https://claude.com/plugins/frontend-design', source: 'claude-plugins-official', summary: '量産感のない上質な React/Vue/Svelte UI を生成（Anthropic製）。', tags: ['公式', 'フロント'], lang: 'ja' },
  { name: 'code-review', url: 'https://claude.com/plugins/code-review', source: 'claude-plugins-official', summary: '専用レビューエージェントで自動 PR レビュー。', tags: ['公式', 'レビュー'], lang: 'ja' },
  { name: 'pr-review-toolkit', url: 'https://claude.com/plugins/pr-review-toolkit', source: 'claude-plugins-official', summary: 'バグ/コンプラ等を並列の専門エージェントでレビュー。', tags: ['公式', 'レビュー'], lang: 'ja' },
  { name: 'commit-commands', url: 'https://claude.com/plugins/commit-commands', source: 'claude-plugins-official', summary: 'ステージ→conventional commit→PR 作成を一括。', tags: ['公式', 'git'], lang: 'ja' },
  { name: 'code-simplifier', url: 'https://claude.com/plugins/code-simplifier', source: 'claude-plugins-official', summary: '可読性・保守性の整理に特化したクリーンアップパス。', tags: ['公式', '品質'], lang: 'ja' },
  { name: 'security-guidance', url: 'https://claude.com/plugins/security-guidance', source: 'claude-plugins-official', summary: '変更ごとに脆弱性をレビューし、その場で修正。', tags: ['公式', 'セキュリティ'], lang: 'ja' },
  { name: 'context7', url: 'https://claude.com/plugins/context7', source: 'claude-plugins-official', summary: 'ライブラリの最新・バージョン整合な API ドキュを文脈に注入（Upstash）。', tags: ['公式', 'ドキュメント'], lang: 'ja' },
  { name: 'mintlify', url: 'https://claude.com/plugins/mintlify', source: 'claude-plugins-official', summary: 'MDX 化とドキュサイト同期（Mintlify 公式）。', tags: ['公式', 'ドキュメント'], lang: 'ja' },
  { name: 'plugin-dev', url: 'https://claude.com/plugins/plugin-dev', source: 'claude-plugins-official', summary: '自作プラグインの雛形・開発ツール。', tags: ['公式', '開発'], lang: 'ja' },
  { name: 'claude-md-management', url: 'https://claude.com/plugins/claude-md-management', source: 'claude-plugins-official', summary: 'CLAUDE.md の整備・プロジェクト自動化の提案。', tags: ['公式', '設定'], lang: 'ja' },

  // --- Anthropic 別マーケット（非エンジニア業務） ---
  { name: 'knowledge-work-plugins', url: 'https://github.com/anthropics/knowledge-work-plugins', source: 'anthropics/knowledge-work-plugins', summary: 'sales / product-management / marketing / legal / finance / data など、業務ロール別プラグイン群（Anthropic）。', tags: ['公式', '業務'], lang: 'ja' },

  // --- コミュニティ ---
  { name: 'wshobson/agents', url: 'https://github.com/wshobson/agents', source: 'wshobson/agents', summary: '94プラグイン/200+エージェントの大型 MIT マーケット（★37k、活発）。', tags: ['コミュニティ', '総合'], lang: 'ja' },
  { name: 'hashicorp/agent-skills', url: 'https://github.com/hashicorp/agent-skills', source: 'hashicorp/agent-skills', summary: 'Terraform/Packer 用スキル（HashiCorp 公式）。', tags: ['コミュニティ', 'IaC'], lang: 'ja' },
  { name: 'neonwatty/qa-skills', url: 'https://github.com/neonwatty/qa-skills', source: 'neonwatty/qa-skills', summary: 'ワークフロー文書から Playwright E2E を生成し、QA エージェント6種を同梱。', tags: ['コミュニティ', 'テスト'], lang: 'ja' },
  { name: 'lgbarn/shipyard', url: 'https://github.com/lgbarn/shipyard', source: 'lgbarn/shipyard', summary: '「アイデア→本番」ライフサイクルと IaC 監査（Terraform/Docker/K8s 等）。', tags: ['コミュニティ', 'DevOps'], lang: 'ja' },
  { name: 'thedotmack/claude-mem', url: 'https://github.com/thedotmack/claude-mem', source: 'thedotmack/claude-mem', summary: 'セッション横断の永続メモリ（要約して次回に再注入）。', tags: ['コミュニティ', 'メモリ'], lang: 'ja' },
  { name: 'SawyerHood/dev-browser', url: 'https://github.com/SawyerHood/dev-browser', source: 'SawyerHood/dev-browser', summary: '低コンテキストなサンドボックス・ブラウザ自動化（Playwright）。', tags: ['コミュニティ', 'ブラウザ'], lang: 'ja' },

  // --- 探索リスト（単体プラグインではないキュレーション） ---
  { name: 'awesome-claude-code', url: 'https://github.com/hesreallyhim/awesome-claude-code', source: 'hesreallyhim/awesome-claude-code', summary: 'スキル/フック/エージェント/プラグインの定番キュレーションリスト（★36.8k）。', tags: ['リスト'], lang: 'ja' },
  { name: 'claude-code-templates', url: 'https://github.com/davila7/claude-code-templates', source: 'davila7/claude-code-templates', summary: '900+ の agent/command/skill/MCP を集めた CLI カタログ。', tags: ['リスト'], lang: 'ja' },
];

/** プラグインを常設 NewsItem に変換（id は名前ベースで一意・安定、日付なし、pinned）。 */
export function pluginsAsNewsItems(): NewsItem[] {
  return PLUGINS.map((p) => ({
    id: stableId(`plugin:${p.name}`),
    title: p.name,
    url: p.url,
    source: p.source,
    publishedAt: '',
    summary: p.summary,
    categories: [PLUGIN_CATEGORY],
    tags: p.tags ?? [],
    lang: p.lang ?? 'en',
    pinned: true,
  }));
}
