# setlist-maker-app

rekordbox のプレイリストエクスポート (txt) から SNS 投稿用のセトリ画像 (1600x900 PNG) を生成するツール。

## セットアップ

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
```

## 操作手順

1. rekordbox からプレイリストを txt エクスポートする
2. 画面左のドロップゾーンにファイルをドラッグ＆ドロップ (またはクリックして選択)
3. アートワークが自動取得される (進捗バー表示)
4. サイドバーでカスタマイズ:
   - **メタデータ** — イベント名・DJ名・日付を編集
   - **テンプレート** — 配色テーマを選択 (Dark Purple / Light / Neon)
   - **背景画像** — 任意の画像をアップロード (オーバーレイ付き)
   - **行数** — スライダーで 10〜18 行/カラムを設定
   - **列数** — 1列 or 2列を選択
   - **ページナビ** — 複数ページ時に前へ/次へで切替
5. 「PNG ダウンロード」で画像を出力 (複数ページ時は全ページ一括)

## プロジェクト構成

```
src/
├── core/                         # コアモジュール
│   ├── parser.ts                 # rekordbox txt パーサー
│   ├── artwork.ts                # アートワーク取得 (iTunes / Deezer)
│   └── layout.ts                 # レイアウト計算 + HTML 生成
│
├── App.tsx                       # メインコンポーネント (状態管理)
├── App.module.css
├── main.tsx                      # エントリポイント
├── types/index.ts                # AppPhase, SetlistTemplate 型定義
│
├── preview/                      # セトリ画像プレビュー
│   ├── SetlistPreview.tsx        # プレビュー全体 (forwardRef, ResizeObserver)
│   ├── Canvas.tsx                # 1600x900 キャンバス + テンプレート CSS 変数
│   ├── Header.tsx                # イベント名・日付・DJ名・曲数・ページ番号
│   ├── Column.tsx                # カラムレイアウト (1列 or 2列)
│   ├── TrackRow.tsx              # トラック1行 (番号, アートワーク, 曲名, BPM 等)
│   └── Brand.tsx                 # ブランド表記 (右下)
│
├── components/                   # サイドバー UI
│   ├── DropZone/                 # ファイルドロップ
│   ├── MetadataEditor/           # メタデータ入力
│   ├── TemplatePicker/           # テンプレート選択
│   ├── BackgroundUploader/       # 背景画像アップロード
│   ├── RowsPerPageSlider/        # 行数スライダー (10〜18)
│   ├── ColumnCountToggle/        # 列数トグル (1列/2列)
│   ├── PageNav/                  # ページナビゲーション
│   ├── ProgressBar/              # アートワーク取得進捗
│   └── ExportButton/             # PNG ダウンロードボタン
│
├── hooks/
│   ├── useExport.ts              # PNG エクスポート (html2canvas)
│   └── useArtworkFetcher.ts      # アートワーク一括取得
│
└── templates/                    # 配色テーマ定義
    ├── dark-purple.ts            # デフォルト (#0f0f23 背景, #e94560 アクセント)
    ├── light.ts                  # ライト (#f5f5f5 背景, #2196f3 アクセント)
    └── neon.ts                   # ネオン (#0a0a0a 背景, #00ff88 アクセント)
```

## 技術仕様

### キャンバス

| 項目 | 値 |
|---|---|
| サイズ | 1600 x 900 px (16:9) |
| パディング | 上 16px, 左右 24px, 下 28px |
| ヘッダー高さ | 56px + margin-bottom 12px |
| カラムエリア高さ | 788px |
| カラム間ギャップ | 16px |
| 行間ギャップ | 2px |

### レイアウト計算

`calculatePageLayout(trackCount, maxRows, columnCount)` で決定。

**行高 (rowHeight)**

行数設定 (`maxRows`) に応じてカラムエリア全体を埋めるよう動的に算出:

```
rowHeight = floor((788 - (maxRows - 1) * 2) / maxRows)
```

| maxRows | rowHeight (px) |
|---------|---------------|
| 10 | 77 |
| 12 | 63 |
| 14 | 54 |
| 16 | 47 |
| 18 | 41 |

最終ページで曲数が `maxRows` 未満の場合も同じ `rowHeight` を使用する (引き伸ばさない)。

**ページ分割**

```
tracksPerPage = maxRows × columnCount
pageCount = ceil(totalTracks / tracksPerPage)   (1ページに収まる場合は1)
```

例: 36曲, maxRows=12, 2列 → tracksPerPage=24, pageCount=2 (24曲 + 12曲)

### トラック行の構成

```
[ 番号 | アートワーク | 曲名 / アーティスト・アルバム | BPM | 時間 | ジャンル ]
```

- アートワークサイズ: `rowHeight - 6` px (正方形, border-radius 4px)
- 番号: 2桁右寄せ, JetBrains Mono
- BPM / 時間: JetBrains Mono
- ジャンルバッジ: 72px 幅, 9px フォント

### パーサー

- 対応エンコーディング: UTF-16LE (BOM `FF FE`), UTF-16BE (BOM `FE FF`), UTF-8
- 対応カラム: `#`, `トラックタイトル`, `アーティスト`, `アルバム`, `BPM`, `時間`, `ジャンル`
- 未知のカラムは無視し、欠落カラムをレポート

### アートワーク取得

iTunes Search API → Deezer API の二段構え。各 API に対して以下の順で検索クエリを緩和:

1. `artist + title` (そのまま)
2. リミックス表記を除去
3. feat. を除去
4. プライマリアーティストのみ
5. タイトルのみ

リクエスト間隔: 3200ms (レートリミット対策)。アートワーク解像度: 600x600px。

### PNG エクスポート

- html2canvas (scale: 2 → 3200x1800px 実解像度)
- `document.fonts.ready` で Web フォント読み込み完了を待機
- 複数ページ時: ページごとに React を再レンダリングし順次キャプチャ
- ファイル名: 1ページ → `{filename}.png`, 複数ページ → `{filename}_1.png`, `{filename}_2.png`, ...

### テンプレートシステム

`SetlistTemplate` インターフェースで 20 色のスロットを定義。Canvas コンポーネントが CSS カスタムプロパティとして注入:

```
--sl-canvas-bg, --sl-header-border, --sl-event, --sl-date,
--sl-dj, --sl-total, --sl-row-odd, --sl-row-even, --sl-num,
--sl-title, --sl-sub, --sl-bpm, --sl-time, --sl-genre-bg,
--sl-genre-text, --sl-no-art, --sl-brand, --sl-overlay
```

背景画像使用時はオーバーレイカラー (`--sl-overlay`) が適用される。

### 状態遷移

```
idle → fetching → ready
       (parseFile 成功後、アートワーク取得開始)
       (全トラック取得完了で ready に遷移)
```

### パスエイリアス

`@core/*` → `src/core/*` (tsconfig + Vite resolve.alias)。コアモジュールを UI コードからインポートする。

### フォント

- UI / セトリ本文: Inter (400, 600)
- 番号 / BPM / 時間 / 日付: JetBrains Mono (400)
