# きまぐれダーツ旅

全国1,741市区町村を精査した1,432件から次の旅先を見つける、GitHub Pages向けの静的なWebアプリです。全国・7地域・47都道府県で範囲を選び、ダーツ盤をタップして投げます。結果画面では自治体の位置データを国土地理院の地図に重ね、国の資料による町の特徴とともに表示します。Googleマップでも調べられます。

候補は市区町村単位で均等に抽選し、直前と同じ町が続けて出るのを避けます。盤面の着弾点は選ばれた候補に対応する抽象的な位置で、実際の地理的位置ではありません。政令指定都市は市単位、東京23区は区単位です。動きを減らす設定では演出を短縮します。

候補一覧・地域地図の確認、最近30回の履歴、町ごとの保存に対応します。保存した町は履歴の30回制限とは別に残ります。以前の版の履歴・保存は元の町を保ったまま移行します。APIキーや実行時サーバーは不要です。

## 開発・公開

```sh
npm ci
npm run check
npm run build
```

開発時は `npm run dev`、公開時は生成される `docs/` をコミットします。GitHub Pages は `main` ブランチの `/docs` を配信します。過去のハッシュ付きJS・CSSと町の資料の分割ファイルを保持し、更新前のHTMLや開いたままのページからも結果を表示できます。新しい版では町の資料を本体に含め、抽選後の追加読み込みをなくしています。

## データと地図

市区町村は Code for FUKUI / localgovjp（CC0）の2026-07-09更新データを使用しています。固定したコミットと加工内容は `public/assets/municipality-source.txt` に記載しています。更新時は `node scripts/import-municipalities.mjs /path/to/localgovjp.json` を実行してください。

抽選対象は、2026年1月1日の住民基本台帳人口が1万人以上、または日本遺産の構成文化財、重要伝統的建造物群保存地区、環境省の35国立公園の関係市町村、世界自然遺産、2025年度にっぽんの温泉100選上位10位のいずれかに該当する市区町村です。人口1万人未満の241件を観光資源の根拠で採用し、309件は今回の資料で根拠を確認できないため保留しています。保留は観光資源がないという判断ではありません。全件の人口、判定、根拠は `public/competition/data/selection.json` と公開サイトの `competition/ren/candidates.html` で確認できます。

出典から抽出したデータは `data/selection-sources/`、変換と照合は `scripts/build-selection.mjs` に記録しています。更新後は `node scripts/build-selection.mjs` で判定データを再生成します。国立公園は35件すべての「関係市町村名」を読んでいます。元の1,741件は基礎台帳として維持し、以前の履歴も表示します。

抽選結果の「町の手掛かり」は、上記の文化庁・環境省の資料にある固有名詞に加え、[総務省統計局「統計でみる市区町村のすがた2026」B 自然環境](https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001484933&page=1)の2024年面積と、[農林水産省「令和6年市町村別農業産出額（推計）詳細品目別データ」](https://www.maff.go.jp/j/tokei/kouhyou/sityoson_sansyutu/)の2024年品目・額・順位から作成しています。数値は資料の基準時点のもので、産出額は各市町村で直接測定した販売額や特産品の認定ではありません。非公表の `x` は利用しません。サイトでは各特徴から元資料へ移動できます。

元のExcelをサイトには同梱しません。取得した `.xls` と `.xlsx` を `python scripts/extract-place-facts.py <e-Stat B .xls> <MAFF 2024 .xlsx>` で小さな `data/feature-sources/` に抽出し、`node scripts/build-place-facts.mjs` で `public/competition/data/place-facts.json` を更新します。後者の照合は `npm run check` に含まれます。観光資料が見つからない町でも統計値を表示し、未掲載を観光地の不存在とは扱いません。

7地域と47都道府県の地図は同梱の日本地図から生成しています。地図の出典と利用条件は `public/assets/map-source.txt` と `map-license.txt` に記載しています。地図更新時は `python scripts/build-region-maps.py` を実行してください。

トップページとレン案の風景写真は、実際の尾道市を千光寺公園から撮影した[そらみみ氏の写真](https://commons.wikimedia.org/wiki/File:Onomichi_Bridge_and_Shin-Onomichi_Bridge_from_Senkoji_Park.jpg)を1,280pxに縮小したものです（[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)）。抽選結果の町を写した写真ではありません。ページ内にも撮影地・作者・ライセンスを表示しています。

`npm run check` で全候補の到達性、地域・県の絞り込み、連続重複の回避、旧履歴の移行と町ごとの保存を確認します。
