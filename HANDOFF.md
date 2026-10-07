# きまぐれダーツ旅 — 引き継ぎ

更新日：2026-10-08（日本時間）。

## 継続する前提

- リポジトリ：https://github.com/Baldiris/kimagure-darts-tabi
- 公開先：https://baldiris.github.io/kimagure-darts-tabi/
- 採用したデザイン案：レン。比較・確認用は `/competition/ren/`。
- GitHub Pages の `main` / `docs` を継続する。
- 全国1,741市区町村を基礎台帳として維持。人口1万人以上または観光資源の根拠によって1,432件を抽選対象に採用、309件を保留。
- 国土地理院の地図と自治体の位置データを使う。町の紹介は文化庁・環境省・総務省統計局・農林水産省の資料に基づき、出典を表示する。
- 履歴・保存・範囲指定など既存の機能を保ち、AIらしい装飾や文章を減らす方針を継続する。

## 前スレッド末尾の修正

トップの結果地図は、県の輪郭から、当選した自治体の位置を示す地理院地図へ変更済み。結果画面の町の資料は本体と同時に読み込む方式へ変更した。以前のページが開いたままでも必要なファイルを取得できるよう、過去のハッシュ付きJS・CSSと資料の分割ファイルをビルドで保持する。

トップのダーツ盤は抽象的な着弾位置、レン案の地図は自治体の座標を使う。両者の違いを保ち、トップの盤面を実際の地理的位置と説明しない。

## 次の作業で見る場所

- トップの画面・状態遷移：`src/App.tsx`、`src/lib/travel-state.ts`
- 結果の地理院地図：`src/components/gsi-destination-map.tsx`
- レン案：`public/competition/ren/`（ビルドで `docs/competition/ren/` に複製）
- 候補の選定と根拠：`scripts/build-selection.mjs`、`public/competition/data/selection.json`
- 町の資料：`scripts/build-place-facts.mjs`、`src/lib/place-facts.ts`
- 公開用ビルドと過去ファイルの保持：`scripts/build-pages.mjs`

## 検証

`npm run check` は全1,741件のデータ整合、1,432件の抽選到達性、47県の範囲指定、連続重複の回避、旧履歴の移行、町ごとの独立した保存を確認する。公開前に `npm run build` を実行して `docs/` も反映する。公開後は、新しいページと更新前から開いたページの両方で、抽選・町の資料・地図・保存・履歴を確認する。
