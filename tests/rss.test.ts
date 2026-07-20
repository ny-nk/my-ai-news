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
