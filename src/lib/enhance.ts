import { loadPrefs, savePrefs, resetPrefs, serializePrefs, parsePrefsBackup } from './storage';
import { computeScore, updatePrefs, emptyPrefs, unhideItem } from './affinity';
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
    pinned: el.dataset.pinned === 'true',
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

  // ステータス通知と 🙅 の取り消し用（クリックハンドラより前に用意する）
  const status = document.getElementById('backup-status');
  const say = (msg: string): void => {
    if (status) status.textContent = msg;
  };
  const undoBtn = document.getElementById('undo') as HTMLButtonElement | null;
  let lastHidden: NewsItem | null = null;

  const visible = (c: CardRef): boolean => {
    if (prefs.hidden.includes(c.item.id)) return false;
    if (state.cats.size && !c.item.categories.some((x) => state.cats.has(x))) return false;
    if (!c.item.pinned && state.lang !== 'all' && c.item.lang !== state.lang) return false;
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
    const count = document.getElementById('result-count');
    if (count) count.textContent = `${scored.length}件表示中（全${cards.length}件）`;
  };

  // 記事内アクション（イベント委譲）
  feed.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('.news-card');
    if (!cardEl) return;
    const ref = cards.find((c) => c.unit.contains(cardEl));
    if (!ref) return;
    const likeBtn = target.closest<HTMLButtonElement>('.like');
    if (likeBtn) {
      prefs = updatePrefs(prefs, ref.item, 'up', SCORING);
      savePrefs(prefs);
      likeBtn.setAttribute('aria-pressed', 'true'); // 押した実感（新着順でも見える）
      say(`「${ref.item.title.slice(0, 24)}」に興味ありを記録しました。`);
      render();
    } else if (target.closest('.hide')) {
      prefs = updatePrefs(prefs, ref.item, 'down', SCORING);
      savePrefs(prefs);
      lastHidden = ref.item;
      if (undoBtn) undoBtn.hidden = false;
      say('非表示にしました。');
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
    if (!confirm('学習した好み・非表示設定をすべて削除します。よろしいですか？')) return;
    resetPrefs();
    prefs = emptyPrefs();
    lastHidden = null;
    if (undoBtn) undoBtn.hidden = true;
    for (const el of document.querySelectorAll('.like[aria-pressed="true"]')) {
      el.setAttribute('aria-pressed', 'false');
    }
    say('学習データをリセットしました。');
    render();
  });

  // 🙅 の取り消し（直前の1件）
  undoBtn?.addEventListener('click', () => {
    if (!lastHidden) return;
    prefs = unhideItem(prefs, lastHidden, SCORING);
    savePrefs(prefs);
    say(`「${lastHidden.title.slice(0, 24)}」を再表示しました。`);
    lastHidden = null;
    undoBtn.hidden = true;
    render();
  });

  // 好みデータのバックアップ / 復元（localStorage は消え得るため）
  document.getElementById('export')?.addEventListener('click', () => {
    const blob = new Blob([serializePrefs(prefs)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-ai-news-prefs.json';
    a.click();
    URL.revokeObjectURL(url);
    say('好みデータを書き出しました。');
  });

  const fileInput = document.getElementById('import-file') as HTMLInputElement | null;
  document.getElementById('import')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const restored = parsePrefsBackup(String(reader.result ?? ''));
      if (!restored) {
        say('読み込めませんでした（形式かバージョンが不正です）。');
      } else {
        prefs = restored;
        savePrefs(prefs);
        lastHidden = null;
        if (undoBtn) undoBtn.hidden = true;
        render();
        say('好みデータを復元しました。');
      }
      fileInput.value = ''; // 同じファイルを再選択できるように
    };
    reader.onerror = () => say('ファイルの読み取りに失敗しました。');
    reader.readAsText(file);
  });

  render();
}
