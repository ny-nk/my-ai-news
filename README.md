# My Tech News

日英の生成AI＋IT一般ニュースを集約し、訪問者ごとにブラウザ内で好みを学習して並び替える公開静的サイト。

- サーバ/DB/ログイン不要。ネットワーク取得はビルド時のみ。
- 好みの学習は各端末の localStorage だけで完結し、外部送信しない。
- 記事はタイトル＋短い抜粋＋元記事リンクのみ（出典明記）。

## 開発

```bash
npm install
npm run fetch     # ニュース取得 → src/data/news.json
npm run dev       # http://localhost:4321/
npm test          # 単体テスト
npm run update    # fetch + build（ワンショット更新）
```

## 自動更新と公開（GitHub Actions → GitHub Pages）

`.github/workflows/update-news.yml` が毎日 22:00 UTC（≒翌 07:00 JST）・手動実行（Actions → Run workflow）・
`main` への push（ドキュメントのみの変更は除く）で動き、ニュース取得 → `news.json` 更新のコミット →
ビルド → Pages へデプロイまで行う。

- 公開URL: <https://ny-nk.github.io/my-tech-news/>
- 初回のみ Settings → Pages → Build and deployment → Source = **GitHub Actions** を設定する。

公開されるのは公開ニュースへのリンクとコードだけで、各利用者の好みデータはブラウザ内（localStorage）に留まる。
スマートフォンからは公開URLをそのまま開けばよい。

## 好みデータの持ち運び

学習した好みは各ブラウザの localStorage にだけ保存される。端末を移るときや、消えたときに備えて2つの手段がある。

- **端末間で共有**: 「端末間で共有」ボタンで同期リンクを作り、別の端末で開く。好みは URL のハッシュに圧縮して入るのでサーバには送信されない。開いた端末の好みは上書きされるが、直後なら「取り込みを取り消す」で戻せる（`seen` は同期対象外）。
- **書き出し / 読み込み**: 「好みを書き出す」で JSON として保存し、「好みを読み込む」で復元する。Safari はサイトを7日間開かないと localStorage を消すため、ときどき書き出しておくとよい。

## 好みの調整

- ソース: `config/sources.ts`
- カテゴリと分類規則: `config/taxonomy.ts`
- スコア重み: `config/scoring.ts`
