# 生成AIニュース リーダー 設計仕様書

- **日付**: 2026-07-20
- **ステータス**: Draft（設計は承認済み、spec レビュー待ち）
- **リポジトリ**: `my-ai-news`

---

## 1. 概要 / 目的

自分好みの **生成AI関連ニュース（＋IT一般）** を集約し、**訪問者ごとにパーソナライズ**して読める **公開静的サイト**。

- 複数人が公開URL（GitHub Pages）を開くだけで利用できる。
- 各訪問者のブラウザが、その人自身の 👍 / 🙅 / クリックを学習して記事を並び替える。
- **ログイン・サーバ・DB 不要**。好みデータは各端末の localStorage のみに保存され、外部に送信されない。

### 設計原則
- **静的サイト**：公開後のサイトは外部を叩かない（速い・壊れにくい・APIキー不要）。ネットワーク取得はビルド時のみ。
- **プログレッシブエンハンスメント**：JS なしでも記事は読める。JS は並び替え／学習の「上乗せ」だけ。
- **YAGNI**：多人数公開でもアカウント／バックエンド／DB を足さない。静的のまま、パーソナライズは各ブラウザ内で完結。
- **透明性・プライバシー**：追跡なし・アカウントなし・状態は各ブラウザ内のみ。ユーザーに明示する。

---

## 2. ユーザーと利用シナリオ

- **利用者**：複数人（公開URLを共有）。ログイン不要。
- **典型シナリオ**：
  1. 公開URLを開くと、直近の生成AI＋IT一般ニュースがカード一覧で表示される。
  2. カテゴリチップ・言語・検索で絞り込む。
  3. 気になる記事を 👍、不要な記事を 🙅、タイトルをクリックして元記事へ。
  4. 操作するほど、その端末のブラウザが好みを学習し「好み順」が最適化される。
  5. いつでも「新着順」に切り替え／「リセット」で学習を初期化できる。
- **鮮度モデル**：ダイジェスト型。秒単位の速報性は不要。「開いた時に前回から更新が追いついていればよい」。cron で1日1〜2回再ビルドすれば十分。

---

## 3. スコープ

### v1 でやること
- 日英両方の生成AI＋IT一般ニュースを、ビルド時に複数ソースから取得・集約。
- ルールベースのカテゴリ／タグ付け（AIスコアリングは使わない）。
- 重複除去、安定ID付与、直近期間へのトリム。
- 静的サイトとして全件を HTML 描画（Astro）。
- クライアント島（素TS）でカテゴリ／言語／検索フィルタ、好み順／新着順の並び替え、👍🙅／クリック学習。
- localStorage による端末ローカルの好みモデル（透明・リセット可・探索枠で多様性確保）。
- GitHub Actions cron → GitHub Pages への自動更新・公開。
- pipeline / affinity の単体テスト（Vitest）。

### v1 でやらないこと（YAGNI）
- アカウント／認証、サーバ／DB、コメント／ソーシャル機能。
- AI 要約・AI スコアリング（分類はルールベースのみ）。
- 記事本文のスクレイピング（フィードの要約のみ使用）。
- 無限バックフィル（直近14日 / 最大300件に限定）。
- 多言語UIフレームワーク（UIは日本語。記事コンテンツは日英）。
- サーバ側パーソナライズ／クロスデバイス同期。

---

## 4. アーキテクチャ

**2層構成。ネットワーク取得はビルド時だけ、好み学習はクライアント内だけ。**

```
[ビルド時 / Node・TS]                         [クライアント / ブラウザ]
 scripts/fetch-news.ts                         src/lib/enhance.ts (素TS島)
   ├─ RSS/フィード取得(サーバ側=CORS回避)         ├─ localStorage の好みモデル読込
   ├─ 正規化 → 重複除去                           ├─ カードを好み順にソート/絞り込み
   ├─ ルールでカテゴリ/タグ付与                    ├─ 👍/🙅・クリックで好みモデル更新
   ├─ 安定ID付与・トリム                          └─ 変更を即再ソート＆localStorage保存
   └─ src/data/news.json を出力                          ▲
            │                                            │ (静的HTML＋data属性)
            ▼                                            │
   Astro build: pages/index.astro が news.json を import
     → NewsCard を静的HTMLで全件描画 + コントロールバー + <script>島
            │
            ▼
     dist/ (静的サイト) → GitHub Pages へ deploy
```

**データフロー**
1. **ビルド**：`fetch-news.ts` がフィードをサーバ側取得 → 正規化 → 重複除去 → 分類 → 安定ID → トリム → `src/data/news.json` 出力。
2. **Astro build**：`index.astro` が `news.json` を import → 全カードを静的HTML描画（`data-*` 属性付き）＋コントロールバー＋`enhance.ts` を同梱。
3. **ランタイム（クライアント）**：`enhance.ts` が localStorage の prefs を読み、各カードをスコア計算 → フィルタ適用 → DOM を並び替え／非表示 → 👍🙅／クリックで prefs 更新・保存・再配置。

---

## 5. データパイプライン

### 5.1 取得ソース（`config/sources.ts` で追加・削除・並び替え可能）
3種類のアダプタで扱う。実フィードURLは**実装時に疎通確認して確定**（フィードは変わり得るため）。

- **直接 RSS/Atom**（一次情報・専門メディア）
  - 英: OpenAI / Anthropic / Google DeepMind ブログ, Hugging Face Blog, The Verge AI, TechCrunch AI, VentureBeat AI, Ars Technica, Simon Willison
  - 日: ITmedia AI＋, ITmedia NEWS, Publickey, Zenn（llm / ai / 生成ai トピック）, はてブ テクノロジー, GIGAZINE
- **Google News RSS 検索**（"AI関連"の網羅担当・言語別クエリ）
  - 日: `生成AI`, `LLM` ほか / 英: `generative AI`, `LLM` ほか
- **Hacker News（Algolia API）**：AIキーワードで上位記事を抽出

### 5.2 カテゴリ（既定7分類・`config` で編集可）
1. LLM・チャットAI / 2. 画像・動画・音声生成 / 3. 研究・論文 / 4. プロダクト・ツール / 5. ビジネス・投資・規制 / 6. OSS・モデル公開 / 7. IT一般

- 主役は生成AI。既定の並びはAI系優先、IT一般は好みで浮上。
- 全カテゴリ既定ON、チップでOFF可。1記事は複数カテゴリ／タグを持てる。

### 5.3 分類・タグ付け
- **ルールベース**：`キーワード→カテゴリ/タグ` 規則をタイトル＋要約に照合。
- カテゴリ（粗）とタグ（細: `RAG`, `agent`, `Claude`, `画像生成` 等）を付与。
- どのAI特化ルールにも当たらない技術系記事は「IT一般」へ。
- **APIキー不要・無料**。

### 5.4 重複除去 / 安定ID
- **URL正規化**（`utm_*` 等トラッキング除去、末尾スラッシュ統一、相対URL解決）。
- 正規化URL＋タイトル類似で同一記事をまとめ、最も権威ある／最古のものを残す。
- **安定ID = 正規化URLのハッシュ**。再ビルドしても id が変わらない → **各ユーザーの localStorage の好みが維持される**（重要）。

### 5.5 出力スキーマ（`src/data/news.json`）
```ts
type NewsItem = {
  id: string;            // 正規化URLのハッシュ（安定）
  title: string;
  url: string;           // 正規化後の元記事URL
  source: string;        // 例 "ITmedia AI+"
  publishedAt: string;   // ISO8601 / UTC
  summary: string;       // フィード要約をHTML除去・truncate（抜粋のみ）
  categories: string[];
  tags: string[];
  lang: "ja" | "en";
};
```
- 新着降順にソート、**直近14日 or 最大300件**にトリム。

### 5.6 取得の堅牢性・エチケット
- ソース毎に `try/catch` ＋タイムアウト＋数回リトライ（指数バックオフ）。**1本落ちてもビルド継続**。
- **全ソース失敗時は前回の `news.json` を保持**（空で上書きしない）。
- 説明的な User-Agent を送る。過剰ポーリング回避（cron 1日1〜2回）。可能なら条件付きGET（ETag / Last-Modified）。

---

## 6. フロントエンド

### 6.1 画面構成（1ページ / `index`）
- **ヘッダー**：タイトル・最終更新時刻（ビルド時刻）・件数・「好みはこの端末内のみ」の一言。
- **コントロールバー**：カテゴリチップ(7種トグル) / 言語トグル(日・英・両方) / 検索ボックス / 並び替え(好み順・新着順) / リセットボタン。
- **NewsCard**：タイトル（別タブで元記事）/ ソース名 / 相対日時 / カテゴリ・タグchip / 👍🙅 / (任意)「なぜ表示?」根拠。
  - `data-*` 属性：`id`, `categories`, `tags`, `source`, `lang`, `publishedAt`（クライアント計算用）。
- **空状態**：フィルタで0件のとき明示メッセージ。

### 6.2 クライアント島 `enhance.ts` の流れ
1. **読込時**：prefs 読取 → 各カードをスコア計算 → 現在のフィルタ適用 → 並び替え → DOM 並べ替え＆非表示反映（**整列後に表示してチラつき防止**）。
2. **操作**：カテゴリ/言語/検索/並び替えトグル、👍🙅、タイトルクリック。
3. **更新時**：prefs 更新 → localStorage 保存 → 再スコア＆再配置。

### 6.3 品質
- プログレッシブエンハンスメント（JSなしでも記事は読める）。
- アクセシビリティ：セマンティックHTML・キーボード操作・十分なコントラスト。
- レスポンシブ、軽量JS、不変アセット。

---

## 7. パーソナライズ / 好みモデル

### 7.1 localStorage スキーマ
```ts
type Prefs = {
  version: 1;
  tags:       Record<string, number>;  // tag -> weight
  sources:    Record<string, number>;  // source -> weight
  categories: Record<string, number>;  // category -> weight
  hidden:     string[];                 // 🙅した記事 id
  seen:       string[];                 // クリック済み id
};
```
- **version** を持たせ、スキーマ不一致・破損時は安全に初期化。

### 7.2 スコア式（`src/lib/affinity.ts`・純粋関数・テスト対象）
```
score(item) = wRecency * recency(item)
            + wAffinity * affinity(item)
            + explore

 recency  = 0.5 ^ (ageDays / halfLife)                 // 例 halfLife=3日。新しいほど1に近い
 affinity = Σ tags[t] + α·Σ categories[c] + β·Σ sources[s]   // 正規化して合算
 explore  = 小さな探索枠（ε-greedy）                    // 多様性確保。一定割合で無関係でも浮上
 hidden の記事は除外（減衰でいずれ復活可）
```
- **更新ルール**：👍 = 特徴量に `+Wup` / 🙅 = `−Wdown` ＋ hidden 追加 / クリック = `+Wclick`（小）＋ seen 追加。
- **「好み順」= フルスコア、「新着順」= recency のみ**。
- 重み（`wRecency`, `wAffinity`, `α`, `β`, `halfLife`, `Wup/Wdown/Wclick`, explore割合）は `config` で調整可。純粋関数なので単体テスト容易。

### 7.3 ベストプラクティスの反映
- **透明性・操作権**：なぜ上位かが分かる／ワンクリックでリセット／常に「新着順」でアルゴリズムから降りられる。
- **フィルターバブル回避**：好きな物だけにせず、explore 枠で新着・多様性を必ず一定割合混ぜる。古いシグナルは減衰。
- **コールドスタート**：学習前は「新着＋選択カテゴリ」で成立。
- **単純・説明可能なモデル**：線形の特徴量重み。ブラックボックス化しない。

---

## 8. 更新・公開

### 8.1 npm scripts
- `fetch` … ニュース取得して `news.json` 生成
- `update` … `fetch` → `build`（ワンショット更新）
- `dev` / `build` / `preview` / `test`

### 8.2 GitHub Actions + Pages
- cron 1日1〜2回 → `checkout` → `npm ci` → `fetch` → `build` → Pages へ deploy。
- **concurrency ガード**で多重実行防止。
- **失敗時は前回のまま**（空デプロイしない）。
- **`news.json` はリポジトリにコミット**（差分が履歴に残る／Actions の60日非活性による自動停止も回避）。
- Pages は公開URL。載るのは公開ニュースへのリンクのみ。**利用者の好みデータはブラウザ内に留まり公開されない**。

---

## 9. テスト（Vitest・ネットワークなし = fixture 使用）

- **pipeline**：正規化 / URL正規化 / 重複除去 / 分類ルール / 安定ID。
- **affinity**：score 計算 / `updatePrefs`（👍🙅クリック）/ hidden 除外 / コールドスタート。
- **（任意）アダプタ**：サンプルフィードを正しくパースするスモークテスト。
- ネットワークは fixture で置き換え、決定的にする。

---

## 10. エラーハンドリング

- **fetch**：ソース毎 `try/catch` ＋タイムアウト＋リトライ。全滅時は前回 `news.json` 保持。
- **client**：localStorage 破損／version不一致時は安全初期化。
- **描画**：0件・全滅時のフォールバックUI。

---

## 11. プロジェクト構成

```
my-ai-news/
├─ astro.config.mjs
├─ package.json
├─ tsconfig.json
├─ config/
│  └─ sources.ts        # フィード一覧(日/英)・カテゴリ定義・キーワード→カテゴリ/タグ規則・重み設定
├─ scripts/
│  └─ fetch-news.ts     # 取得→正規化→重複除去→分類→安定ID→トリム→ news.json 出力
├─ src/
│  ├─ data/news.json    # 生成物（リポジトリにコミット）
│  ├─ lib/
│  │  ├─ types.ts       # NewsItem, Prefs 等の型
│  │  ├─ pipeline.ts    # 正規化/URL正規化/重複除去/分類/安定ID（純粋関数・テスト対象）
│  │  ├─ affinity.ts    # 好みスコア計算・updatePrefs（純粋関数・テスト対象）
│  │  ├─ storage.ts     # localStorage 読み書き（クライアント）
│  │  └─ enhance.ts     # クライアント島：ソート/絞り込み/👍🙅/クリック
│  ├─ components/       # NewsCard.astro / ControlBar.astro など
│  └─ pages/index.astro # news.json を import して描画＋<script>島
├─ tests/               # pipeline / affinity の単体テスト
└─ .github/workflows/
   └─ build-deploy.yml  # 定期取得→ビルド→Pages公開
```

---

## 12. 技術スタック

- **Astro**（静的サイト生成・ビルド時データ取得・素TSスクリプト島）
- **TypeScript**
- **RSS/Atom パーサ**（実装時に選定：`rss-parser` または `fast-xml-parser`）
- **Vitest**（単体テスト）
- **GitHub Actions / GitHub Pages**（自動更新・公開）

---

## 13. 法務・エチケット（公開サイトの必須事項）

- **全文転載しない**。タイトル＋短い要約（抜粋）＋元記事へのリンクに留める。
- **出典（ソース名）を明示**。
- 一部フィードは再配布を禁じる規約があるため、「リンク＋短い抜粋」の定石を守る。

---

## 14. 実装時に確定する項目

- 各実フィードURLの疎通確認と確定（`config/sources.ts`）。
- cron 頻度（1日1回 or 2回）。
- スコア重み・explore割合・halfLife・トリム日数/件数の初期値チューニング。
- RSSパーサライブラリの選定。
- GitHub Pages のリポジトリ設定（公開範囲・カスタムドメイン有無）。
