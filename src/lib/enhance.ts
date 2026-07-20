import { loadPrefs, savePrefs, resetPrefs } from './storage';
import { computeScore, updatePrefs, emptyPrefs } from './affinity';
import { SCORING } from '../../config/scoring';
import type { NewsItem, Prefs, Lang } from './types';

interface CardRef {
  unit: HTMLElement; // 並び替え/非表示の単位（<li> か .news-card）
  item: NewsItem;
}

function parseCard(el: HTMLElement): NewsItem {
  const titleEl = el.querySelector<HTMLAnchorElement>('.title');
  const split = (s: string | undefined) => (s ?? '').split('|').filter(Boolean);
  return {
    id: el.dataset.id ?? '',
    title: titleEl?.textContent?.trim() ?? '',
    url: titleEl?.href ?? '',
    source: el.dataset.source ?? '',
    publishedAt: el.dataset.published ?? '',
    summary: el.querySelector('.summary')?.textContent ?? '',
    categories: split(el.dataset.categories),
    tags: split(el.dataset.tags),
    lang: (el.dataset.lang as Lang) ?? 'en',
  };
}

export function initEnhance(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const cards: CardRef[] = [...feed.querySelectorAll<HTMLElement>('.news-card')].map((el) => ({
    unit: (el.closest('li') as HTMLElement) ?? el,
    item: parseCard(el),
  }));

  let prefs: Prefs = loadPrefs();
  const state = {
    cats: new Set<string>(),
    lang: 'all' as 'all' | Lang,
    query: '',
    sort: 'affinity' as 'affinity' | 'recent',
  };
  const now = Date.now();

  const visible = (c: CardRef): boolean => {
    if (prefs.hidden.includes(c.item.id)) return false;
    if (state.cats.size && !c.item.categories.some((x) => state.cats.has(x))) return false;
    if (state.lang !== 'all' && c.item.lang !== state.lang) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = `${c.item.title} ${c.item.summary} ${c.item.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const render = (): void => {
    const shown = cards.filter(visible);
    const scored = shown.map((c) => ({
      c,
      key:
        state.sort === 'recent'
          ? new Date(c.item.publishedAt).getTime()
          : computeScore(c.item, prefs, SCORING, now),
    }));
    scored.sort((a, b) => b.key - a.key);
    for (const c of cards) c.unit.hidden = true;
    for (const { c } of scored) {
      c.unit.hidden = false;
      feed.appendChild(c.unit);
    }
    const empty = document.getElementById('empty');
    if (empty) empty.hidden = scored.length !== 0;
  };

  // 記事内アクション（イベント委譲）
  feed.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('.news-card');
    if (!cardEl) return;
    const ref = cards.find((c) => c.unit.contains(cardEl));
    if (!ref) return;
    if (target.closest('.like')) {
      prefs = updatePrefs(prefs, ref.item, 'up', SCORING);
      savePrefs(prefs);
      render();
    } else if (target.closest('.hide')) {
      prefs = updatePrefs(prefs, ref.item, 'down', SCORING);
      savePrefs(prefs);
      render();
    } else if (target.closest('.title')) {
      prefs = updatePrefs(prefs, ref.item, 'click', SCORING);
      savePrefs(prefs); // 遷移はそのまま許可（re-render しない）
    }
  });

  // コントロールバー
  document.querySelectorAll<HTMLInputElement>('.cat-chip-input').forEach((chip) => {
    chip.addEventListener('change', () => {
      if (chip.checked) state.cats.add(chip.value);
      else state.cats.delete(chip.value);
      render();
    });
  });
  const langSel = document.getElementById('lang') as HTMLSelectElement | null;
  langSel?.addEventListener('change', () => {
    state.lang = langSel.value as 'all' | Lang;
    render();
  });
  const search = document.getElementById('search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  const sortSel = document.getElementById('sort') as HTMLSelectElement | null;
  sortSel?.addEventListener('change', () => {
    state.sort = sortSel.value as 'affinity' | 'recent';
    render();
  });
  document.getElementById('reset')?.addEventListener('click', () => {
    resetPrefs();
    prefs = emptyPrefs();
    render();
  });

  render();
}
