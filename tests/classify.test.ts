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
  it('does not false-match short ASCII patterns inside larger words', () => {
    const r = classify(item('The therapist gave average advice on newspaper storage'));
    expect(r.categories).toEqual(['IT一般']); // no api/rag/paper false hits
    expect(r.tags).toEqual([]);
  });
  it('still matches ASCII patterns as whole words', () => {
    const r = classify(item('New API released for the agent'));
    expect(r.categories).toContain('プロダクト・ツール');
  });
});
