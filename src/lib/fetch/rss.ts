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
