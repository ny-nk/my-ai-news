import type { Rule } from '../src/lib/types';

export const CATEGORIES = [
  'LLM・チャットAI',
  '画像・動画・音声生成',
  '研究・論文',
  'プロダクト・ツール',
  'ビジネス・投資・規制',
  'OSS・モデル公開',
  'IT一般',
  'Claude Codeプラグイン',
] as const;

export const DEFAULT_CATEGORY = 'IT一般';

/** プラグイン常設カード用の固定カテゴリ（分類器を通さず付与） */
export const PLUGIN_CATEGORY = 'Claude Codeプラグイン';

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
