import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SOURCES } from '../config/sources';
import { fetchAll } from '../src/lib/fetch';
import { assembleNews } from '../src/lib/assemble';

const OUT = 'src/data/news.json';
const META = 'src/data/meta.json';

/** ヘッダー表示用: 取得の実施時刻とソースの成否（失敗が見えないと欠落に気付けない） */
function writeMeta(failures: string[]): void {
  mkdirSync(dirname(META), { recursive: true });
  const meta = {
    builtAt: new Date().toISOString(),
    sourcesTotal: SOURCES.length,
    sourcesFailed: failures,
  };
  writeFileSync(META, JSON.stringify(meta, null, 2) + '\n');
}

async function main() {
  const { items, failures } = await fetchAll(SOURCES);
  if (failures.length) console.warn(`[fetch] failed sources: ${failures.join(', ')}`);

  const news = assembleNews(items, Date.now(), { days: 14, max: 300 });
  writeMeta(failures);

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
