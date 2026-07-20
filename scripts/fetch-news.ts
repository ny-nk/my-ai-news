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
