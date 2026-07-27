import { loadPrefs, savePrefs, resetPrefs, serializePrefs, parsePrefsBackup } from './storage';
import { computeScore, updatePrefs, emptyPrefs, unhideItem } from './affinity';
import { SCORING } from '../../config/scoring';
import { buildSyncUrl, readSyncedPrefs } from './sync';
import type { NewsItem, Prefs, Lang } from './types';

interface CardRef {
  unit: HTMLElement; // 並び替え/非表示の単位（<li> か .news-card）
  el: HTMLElement; // .news-card 本体（既読クラスの付け外し用）
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
    el,
    item: parseCard(el),
  }));

  let prefs: Prefs = loadPrefs();

  // フィードから消えた記事の id を掃除（トリムで14日より古い記事は戻らないため）
  {
    const feedIds = new Set(cards.map((c) => c.item.id));
    const hidden = prefs.hidden.filter((id) => feedIds.has(id));
    const seen = prefs.seen.filter((id) => feedIds.has(id));
    const viewed = prefs.viewed.filter((id) => feedIds.has(id));
    if (
      hidden.length !== prefs.hidden.length ||
      seen.length !== prefs.seen.length ||
      viewed.length !== prefs.viewed.length
    ) {
      prefs = { ...prefs, hidden, seen, viewed };
      savePrefs(prefs);
    }
  }
  const state = {
    cats: new Set<string>(),
    lang: 'ja' as 'all' | Lang, // 既定は日本語（ControlBar の selected と一致させる）
    query: '',
    sort: 'affinity' as 'affinity' | 'recent',
    unreadOnly: false,
  };
  let seenSet = new Set(prefs.seen);

  // ステータス通知と 🙅 の取り消し用（クリックハンドラより前に用意する）
  const status = document.getElementById('backup-status');
  const say = (msg: string): void => {
    if (status) status.textContent = msg;
  };
  const undoBtn = document.getElementById('undo') as HTMLButtonElement | null;
  let lastHidden: NewsItem | null = null;

  const visible = (c: CardRef): boolean => {
    if (prefs.hidden.includes(c.item.id)) return false;
    if (state.unreadOnly && seenSet.has(c.item.id)) return false;
    if (state.cats.size && !c.item.categories.some((x) => state.cats.has(x))) return false;
    if (!c.item.pinned && state.lang !== 'all' && c.item.lang !== state.lang) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = `${c.item.title} ${c.item.summary} ${c.item.source} ${c.item.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const render = (): void => {
    const now = Date.now(); // 都度取得（開きっぱなしのタブで順位が陳腐化しないように）
    seenSet = new Set(prefs.seen);
    const viewedSet = new Set(prefs.viewed);
    const shown = cards.filter(visible);
    const scored = shown.map((c) => ({
      c,
      key:
        state.sort === 'recent'
          ? new Date(c.item.publishedAt).getTime()
          : computeScore(c.item, prefs, SCORING, now),
    }));
    scored.sort((a, b) => b.key - a.key);

    // 常設カード（プラグイン）は日付がなくスコア最下位に沈むため、
    // 日替わりで2枚だけ上部に混ぜ込む。残りは末尾（カテゴリチップで全件見られる）。
    const pinned = scored.filter((s) => s.c.item.pinned);
    const rest = scored.filter((s) => !s.c.item.pinned);
    let ordered = scored;
    if (pinned.length && rest.length) {
      const day = Math.floor(now / 86400000);
      const rot = day % pinned.length;
      const rotated = [...pinned.slice(rot), ...pinned.slice(0, rot)];
      const picks = rotated.slice(0, 2);
      const leftovers = rotated.slice(2);
      ordered = [...rest];
      [4, 12].forEach((pos, i) => {
        if (picks[i]) ordered.splice(Math.min(pos, ordered.length), 0, picks[i]);
      });
      ordered.push(...leftovers);
    }

    for (const c of cards) c.unit.hidden = true;
    for (const { c } of ordered) {
      c.unit.hidden = false;
      c.el.classList.toggle('seen', seenSet.has(c.item.id));
      c.el.classList.toggle('viewed', viewedSet.has(c.item.id));
      feed.appendChild(c.unit);
    }
    const empty = document.getElementById('empty');
    if (empty) empty.hidden = ordered.length !== 0;
    const count = document.getElementById('result-count');
    if (count) count.textContent = `${ordered.length}件表示中（全${cards.length}件）`;
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
      ref.el.classList.add('seen'); // 既読の見た目だけ即時反映
    }
  });

  // 絞り込みを変えたら結果の先頭が見えるように戻す（下の方で操作したときの迷子防止）
  const scrollToFeedTop = (): void => {
    const before = scrollY;
    if (before <= 0) return;
    const top = (document.querySelector('.chips-block') as HTMLElement | null)?.offsetTop ?? 0;
    scrollTo({ top, behavior: 'smooth' });
    // smooth が途中で止まる/効かない環境でも目的地に着地させる
    const settle = (delay: number): void => {
      setTimeout(() => {
        // behavior は必ず instant を明示する（CSS の scroll-behavior:smooth を
        // 継承すると、フォールバックのはずが再び滑らかスクロールになり着地しない）
        if (Math.abs(scrollY - top) > 8) scrollTo({ top, behavior: 'instant' });
      }, delay);
    };
    settle(400);
    settle(1200);
  };

  // コントロールバー
  document.querySelectorAll<HTMLInputElement>('.cat-chip-input').forEach((chip) => {
    chip.addEventListener('change', () => {
      if (chip.checked) state.cats.add(chip.value);
      else state.cats.delete(chip.value);
      render();
      scrollToFeedTop();
    });
  });
  const langSel = document.getElementById('lang') as HTMLSelectElement | null;
  langSel?.addEventListener('change', () => {
    state.lang = langSel.value as 'all' | Lang;
    render();
    scrollToFeedTop();
  });
  const search = document.getElementById('search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  const unreadChk = document.getElementById('unread-only') as HTMLInputElement | null;
  unreadChk?.addEventListener('change', () => {
    state.unreadOnly = unreadChk.checked;
    render();
    scrollToFeedTop();
  });
  const sortSel = document.getElementById('sort') as HTMLSelectElement | null;
  sortSel?.addEventListener('change', () => {
    state.sort = sortSel.value as 'affinity' | 'recent';
    render();
    scrollToFeedTop();
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

  // 閲覧の印（薄く表示）だけを消す。好みの学習・非表示設定はそのまま。
  document.getElementById('clear-viewed')?.addEventListener('click', () => {
    if (prefs.viewed.length === 0 && prefs.seen.length === 0) {
      say('消す閲覧の印はありません。');
      return;
    }
    prefs = { ...prefs, viewed: [], seen: [] };
    savePrefs(prefs);
    for (const el of document.querySelectorAll('.news-card.viewed, .news-card.seen')) {
      el.classList.remove('viewed', 'seen');
    }
    say('閲覧の印を消しました。');
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
    a.download = 'my-tech-news-prefs.json';
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

  // 端末間共有: リンク生成
  const panel = document.getElementById('sync-panel');
  const urlBox = document.getElementById('sync-url') as HTMLTextAreaElement | null;
  document.getElementById('sync')?.addEventListener('click', async () => {
    if (!panel || !urlBox) return;
    const stripped = new URL(location.href);
    stripped.hash = '';
    urlBox.value = await buildSyncUrl(prefs, stripped.toString());
    panel.hidden = false;
    urlBox.select();
    say('同期リンクを作成しました。別の端末で開いてください。');
  });
  document.getElementById('sync-copy')?.addEventListener('click', async () => {
    if (!urlBox) return;
    try {
      await navigator.clipboard.writeText(urlBox.value);
      say('リンクをコピーしました。');
    } catch {
      urlBox.select();
      say('コピーできませんでした。選択された文字列を手動でコピーしてください。');
    }
  });
  document.getElementById('sync-close')?.addEventListener('click', () => {
    if (panel) panel.hidden = true;
  });

  // 端末間共有: URL ハッシュから取り込み（上書き。直前の状態には undo で戻せる）
  const importFromHash = async (): Promise<void> => {
    const incoming = await readSyncedPrefs(location.hash);
    if (incoming === undefined) return; // 同期リンクではない
    // ペイロードを URL から消す（履歴に残さない・再読み込みで再適用しない）
    history.replaceState(null, '', location.pathname + location.search);
    if (incoming === null) {
      say('同期リンクを読み取れませんでした（リンクが壊れているようです）。');
      return;
    }
    const previous = prefs;
    // seen / viewed は同期対象外なので手元の値を残す
    prefs = { ...incoming, seen: prefs.seen, viewed: prefs.viewed };
    savePrefs(prefs);
    render();
    say('別の端末の好みを取り込みました。');
    const undoSync = document.getElementById('undo-sync') as HTMLButtonElement | null;
    if (undoSync) {
      undoSync.hidden = false;
      undoSync.addEventListener(
        'click',
        () => {
          prefs = previous;
          savePrefs(prefs);
          undoSync.hidden = true;
          say('取り込みを取り消しました。');
          render();
        },
        { once: true },
      );
    }
  };

  // 初回読み込み時と、開いたままのページにリンクが貼られた場合（ハッシュ変化）の両方に対応
  void importFromHash();
  addEventListener('hashchange', () => void importFromHash());

  setupControlsScroll();
  setupBackToTop(); // 固定バーの設定とは独立させる（片方が失敗しても他方は動く）
  setupThumbFallback();
  setupViewTracking(cards, () => prefs, (next) => {
    prefs = next;
    savePrefs(prefs);
  });
  render();
}

/** 画面に留まったとみなす時間（一瞬かすめただけでは「見た」にしない） */
const VIEW_DWELL_MS = 1500;

/** 閲覧済み ID をまとめて取り込む（重複は無視。変化が無ければ null を返す）。 */
export function mergeViewed(prefs: Prefs, ids: string[]): Prefs | null {
  const viewed = new Set(prefs.viewed);
  let added = false;
  for (const id of ids) {
    if (!id || viewed.has(id)) continue;
    viewed.add(id);
    added = true;
  }
  return added ? { ...prefs, viewed: [...viewed] } : null;
}

/**
 * 画面に一定時間表示された記事を「閲覧済み」として記録する。
 * ニュースは1日1回しか更新されないので、前回どこまで目を通したかが分かると
 * 同じ記事を何度も読み直さずに済む。
 */
function setupViewTracking(
  cards: CardRef[],
  getPrefs: () => Prefs,
  setPrefs: (next: Prefs) => void,
): void {
  if (typeof IntersectionObserver === 'undefined') return;

  const byElement = new Map<Element, CardRef>();
  for (const c of cards) byElement.set(c.el, c);

  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  let pending: string[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  // まとめて保存する（記事ごとに localStorage を書くと重い）
  const flush = (): void => {
    flushTimer = undefined;
    if (pending.length === 0) return;
    const next = mergeViewed(getPrefs(), pending);
    pending = [];
    if (next) setPrefs(next);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const ref = byElement.get(entry.target);
        if (!ref) continue;
        if (entry.isIntersecting) {
          if (timers.has(entry.target)) continue;
          timers.set(
            entry.target,
            setTimeout(() => {
              timers.delete(entry.target);
              entry.target.classList.add('viewed');
              pending.push(ref.item.id);
              if (!flushTimer) flushTimer = setTimeout(flush, 1000);
            }, VIEW_DWELL_MS),
          );
        } else {
          // 通り過ぎただけなら記録しない
          const t = timers.get(entry.target);
          if (t) {
            clearTimeout(t);
            timers.delete(entry.target);
          }
        }
      }
    },
    { threshold: 0.5 }, // カードの半分以上が見えている状態を「表示中」とする
  );

  for (const c of cards) io.observe(c.el);
  // 離脱時に取りこぼしを保存
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/**
 * サムネは外部サイトの画像を直接参照しているので、消えたり弾かれたりする。
 * 壊れた画像アイコンや空枠が残らないよう、読み込み失敗したら枠ごと取り除く。
 */
function setupThumbFallback(): void {
  const drop = (e: Event): void => {
    const img = e.target as HTMLElement | null;
    if (img?.tagName !== 'IMG') return;
    img.closest('.thumb')?.remove();
  };
  // error はバブリングしないので capture で拾う
  document.addEventListener('error', drop, true);
}

const PIN_KEY = 'my-tech-news:pin-controls';

/**
 * 操作バーの固定切り替え。
 * 固定そのものは CSS の position:sticky に任せる（スクロール中に高さを変えないので
 * ガタつきや点滅が起きない）。ここは設定の読み書きだけを担う。
 */
function setupControlsScroll(): void {
  const controls = document.getElementById('controls-bar');
  if (!controls) return;
  const pin = document.getElementById('pin-controls') as HTMLInputElement | null;

  let pinned = true;
  try {
    pinned = localStorage.getItem(PIN_KEY) !== 'off';
  } catch {
    /* ストレージが使えなくても既定（固定）で動かす */
  }
  const applyPinned = (): void => {
    controls.classList.toggle('controls-unpinned', !pinned);
  };
  if (pin) pin.checked = pinned;
  applyPinned();

  pin?.addEventListener('change', () => {
    pinned = pin.checked;
    try {
      localStorage.setItem(PIN_KEY, pinned ? 'on' : 'off');
    } catch {
      /* 保存できなくても表示は切り替える */
    }
    applyPinned();
  });
}

/**
 * 「先頭へ戻る」。固定バー内に置いてあるので、4万px 下からでも1タップで
 * 絞り込みチップのある先頭まで戻れる。
 * 表示制御は IntersectionObserver（スクロールイベントを使わないので軽い）。
 */
function setupBackToTop(): void {
  const btn = document.getElementById('to-top') as HTMLButtonElement | null;
  if (!btn) return;

  // スクロール量は環境で取得元が違う（iOS Safari 等で window.scrollY が 0 のまま
  // documentElement/body 側だけ動くことがある）ので、取れる値の最大を使う。
  const currentY = (): number =>
    Math.max(
      window.scrollY || 0,
      document.documentElement.scrollTop || 0,
      document.body.scrollTop || 0,
    );

  btn.addEventListener('click', () => {
    const before = currentY();
    scrollTo({ top: 0, behavior: 'smooth' });
    // smooth が途中で止まる/効かない環境でも必ず先頭に着地させる
    const settle = (delay: number): void => {
      setTimeout(() => {
        if (currentY() <= 0 || currentY() < before - 1) return; // 進んでいるなら任せる
        // behavior は必ず instant を明示する（CSS の scroll-behavior:smooth を
        // 継承すると、フォールバックのはずが再び滑らかスクロールになり着地しない）
        scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0; // scrollTo が無効な環境向け
        document.body.scrollTop = 0;
      }, delay);
    };
    settle(400);
    settle(1200);
    // キーボード利用者が絞り込みチップへ直接進めるようにフォーカスも移す
    document.querySelector<HTMLInputElement>('.cat-chip-input')?.focus({ preventScroll: true });
  });

  // 先頭付近では不要なので隠す。スクロール量で判定（IntersectionObserver より
  // 「どれだけ下にいるか」を直接扱えて、しきい値の意味が明確）。
  const sync = (): void => {
    const shouldShow = currentY() >= 400;
    if (btn.hidden === shouldShow) btn.hidden = !shouldShow; // 変化時だけ触る
  };
  sync();
  // 真偽値ひとつの更新なので rAF を挟まず直接同期する
  // （rAF は描画停止中に回らないため、ここで待つと反映が漏れる）
  addEventListener('scroll', sync, { passive: true });
  // スクロールを取りこぼす環境（慣性中にイベントが来ない等）への保険
  addEventListener('touchmove', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });
}
