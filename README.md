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

## 自動更新（GitHub Actions）

`.github/workflows/update-news.yml` が毎日 22:00 UTC（≒翌 07:00 JST）と手動実行（Actions → Run workflow）で
ニュースを取得し、変更があれば `src/data/news.json` をコミットする。閲覧はローカルで `npm run dev`。

## 公開したくなったら（GitHub Pages）

Pages はパブリックリポジトリ（または GitHub Pro 以上のプライベート）で使える。有効化する手順:

1. Settings → Pages → Build and deployment → Source = **GitHub Actions**。
2. `update-news.yml` のビルドステップに環境変数を追加する。

   ```yaml
   - name: Build
     run: npm run build
     env:
       BASE_PATH: /${{ github.event.repository.name }}/
       SITE_URL: https://${{ github.repository_owner }}.github.io
   ```

3. 同ワークフローに Pages 用の権限（`pages: write`、`id-token: write`）と、
   `actions/upload-pages-artifact@v3`（`path: dist`）→ `actions/deploy-pages@v4` のジョブを追加する。
4. 公開URL: `https://<user>.github.io/<repo>/`

公開しても外部に出るのは公開ニュースへのリンクとコードのみで、各利用者の好みデータはブラウザ内に留まる。

## 好みの調整

- ソース: `config/sources.ts`
- カテゴリと分類規則: `config/taxonomy.ts`
- スコア重み: `config/scoring.ts`
