# きまぐれダーツ旅

全国47都道府県・7エリアから行き先を抽選する旅のLPです。ダーツ演出、投げ直し、Googleマップへのリンクを備えています。

## 開発

```sh
npm ci
npm run dev
```

## 公開

```sh
npm run build
```

生成される `docs/` をコミットしてください。GitHub Pages の公開元は `main` ブランチの `/docs` です。静的ファイルのみで動作し、APIキー・サーバーは不要です。

画像・地図・スクリプトは相対パスにしているため、プロジェクトURL配下でも読み込めます。地図の利用条件・出典は `public/assets/map-license.txt` と `map-source.txt` に記載しています。写真はAIで生成した旅のイメージです。
