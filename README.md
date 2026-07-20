# My AI News

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

## 公開（GitHub Pages）

1. GitHub にリポジトリを作成して push。
2. Settings → Pages → Build and deployment → Source = **GitHub Actions**。
3. `.github/workflows/build-deploy.yml` が cron（既定: 毎日）と手動（Actions → Run workflow）で取得→ビルド→公開する。
4. 公開URL: `https://<user>.github.io/<repo>/`（`BASE_PATH` はワークフローがリポジトリ名から自動設定）。

## 好みの調整

- ソース: `config/sources.ts`
- カテゴリと分類規則: `config/taxonomy.ts`
- スコア重み: `config/scoring.ts`
