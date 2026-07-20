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
