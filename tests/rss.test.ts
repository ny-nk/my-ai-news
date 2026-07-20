import { describe, it, expect } from 'vitest';
import { parseRssXml, fetchRss } from '../src/lib/fetch/rss';

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
    expect(out[0].summary).toBe('Body text');
  });
});

describe('fetchRss', () => {
  it('fetches via injected getText then parses', async () => {
    const out = await fetchRss('https://example.com/feed', 'Example', 'en', async () => SAMPLE);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Hello AI');
    expect(out[0].url).toBe('https://example.com/hello');
    expect(out[0].source).toBe('Example');
  });
});

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Post</title>
    <link href="https://example.com/atom-post"/>
    <updated>2026-07-19T08:00:00Z</updated>
    <content type="html">&lt;p&gt;Atom body&lt;/p&gt;</content>
  </entry>
</feed>`;

describe('parseRssXml (Atom)', () => {
  it('parses an Atom entry (link href, updated, content)', async () => {
    const out = await parseRssXml(ATOM, 'AtomSrc', 'ja');
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Atom Post');
    expect(out[0].url).toBe('https://example.com/atom-post');
    expect(out[0].publishedAt).toBeTruthy();
    expect(out[0].lang).toBe('ja');
  });
});
