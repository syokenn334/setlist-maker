/**
 * セトリレイアウト生成モジュール
 *
 * - トラック配列からセトリ画像用の HTML/CSS を生成する
 * - 1600x900px (Twitter 16:9) キャンバス
 * - 20曲以下 → 1カラム、21曲以上 → 2カラム
 * - 自己完結 HTML (CSS インライン)
 */

import type { Track } from "./parser";
import type { ArtworkResult } from "./artwork";

// --- 型定義 ---

export interface TrackWithArtwork extends Track {
  artworkUrl: string | null;
}

export interface SetlistMetadata {
  eventName: string;
  djName: string;
  date: string;
}

export interface LayoutInfo {
  columnCount: 1 | 2;
  rowsPerColumn: number;
  /** 右カラムの行数 (ロゴ干渉で左より少ない時に設定) */
  rightColumnRows?: number;
  /** 1カラム20行以上の場合は行高を縮小 */
  rowHeight: number;
  rowGap: number;
}

// --- アスペクト比 ---

export type AspectRatio = '16:9' | '9:16' | '7:8';

export const CANVAS_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1600, height: 900 },
  '9:16': { width: 900, height: 1600 },
  '7:8': { width: 1050, height: 1200 },
};

// --- レイアウト定数 (single source of truth) ---
// Canvas の padding と Header の寸法は CSS と同期させる必要あり
// (Canvas.module.css : padding 16px 24px 28px / Header の height + margin-bottom)

/** Canvas 左右パディング (Canvas.module.css padding-x と一致) */
export const CANVAS_PAD_X = 24;
/** Canvas 上パディング */
export const CANVAS_PAD_TOP = 16;
/** Canvas 下パディング */
export const CANVAS_PAD_BOTTOM = 28;
/** ヘッダー高さ + margin-bottom (Header.module.css と一致) */
export const HEADER_HEIGHT_WITH_MARGIN = 56 + 12;
/** Canvas 縦パディング合計 (上 + 下) */
export const CANVAS_PAD_Y = CANVAS_PAD_TOP + CANVAS_PAD_BOTTOM;
/** カラムエリア上部の合計予約高 (縦パディング + ヘッダー) */
export const PADDING_AND_HEADER = CANVAS_PAD_Y + HEADER_HEIGHT_WITH_MARGIN;
/** 2カラム時のカラム間ギャップ */
export const COL_GAP = 16;

/** 任意のキャンバス高さから列エリアの利用可能高を計算 */
export function getColumnHeight(canvasHeight: number): number {
  return canvasHeight - PADDING_AND_HEADER;
}

export function getColumnAreaHeight(aspect: AspectRatio): number {
  return getColumnHeight(CANVAS_SIZES[aspect].height);
}

// --- レイアウト計算 ---

/** カラムエリアの利用可能高さ (canvas 900 - padding 44 - header 68) */
const COLUMN_AREA_HEIGHT = getColumnHeight(900);

/**
 * ページ単位のレイアウト計算 (行数・カラム数指定)
 *
 * - maxRows で1カラムあたりの最大行数を固定
 * - columnCount はユーザー指定 (1 or 2)
 * - rowHeight は maxRows 基準で算出し、カラムエリアをフルに使う
 *   → 最終ページで曲数が少なくても rowHeight は変わらない
 */
export function calculatePageLayout(
  trackCount: number,
  maxRows: number,
  columnCount: 1 | 2,
  canvasHeight: number = 900,
  logoRowsOccupied: number = 0,
): LayoutInfo {
  const clamped = Math.max(8, Math.min(18, maxRows));
  const rowGap = 2;

  const areaHeight = getColumnHeight(canvasHeight);

  // 行高は常に maxRows 基準でカラムエリアをぴったり埋める (非整数で OK)
  // → リスト総高 = areaHeight になり、rowsPerPage を変えても列底位置が動かない
  const rowHeight = (areaHeight - (clamped - 1) * rowGap) / clamped;

  // 2カラム時は左を maxRows まで埋めてから右に折り返す
  const rowsPerColumn =
    columnCount === 1 ? trackCount : Math.min(trackCount, clamped);

  // 2カラム + ロゴ干渉時は右カラムの行数を減らす
  let rightColumnRows: number | undefined;
  if (columnCount === 2 && logoRowsOccupied > 0) {
    rightColumnRows = Math.max(0, clamped - logoRowsOccupied);
  }

  return { columnCount, rowsPerColumn, rightColumnRows, rowHeight, rowGap };
}

/** rowHeight だけを計算したい場合のヘルパー (ロゴ計算等) */
export function calculateRowHeight(
  maxRows: number,
  canvasHeight: number,
): { rowHeight: number; rowGap: number } {
  const clamped = Math.max(8, Math.min(18, maxRows));
  const rowGap = 2;
  const areaHeight = getColumnHeight(canvasHeight);
  const rowHeight = (areaHeight - (clamped - 1) * rowGap) / clamped;
  return { rowHeight, rowGap };
}

/**
 * トラック数からカラム分割とサイズを計算
 */
export function calculateLayout(trackCount: number): LayoutInfo {
  if (trackCount <= 20) {
    // 1カラム: 行高 40px (20曲でも収まるように縮小)
    // ただし少ない曲数なら 42px でも余裕あり
    const rowHeight = trackCount > 18 ? 40 : 42;
    const rowGap = 2;
    return { columnCount: 1, rowsPerColumn: trackCount, rowHeight, rowGap };
  }

  // 2カラム: 均等分割 (端数は左カラムに)
  const rowsPerColumn = Math.ceil(trackCount / 2);
  return { columnCount: 2, rowsPerColumn, rowHeight: 42, rowGap: 2 };
}

/**
 * トラック配列をカラム数で分割
 */
export function splitTracks<T>(tracks: T[], layout: LayoutInfo): T[][] {
  if (layout.columnCount === 1) return [tracks];

  const leftCount = layout.rowsPerColumn;
  const rightCount = layout.rightColumnRows ?? layout.rowsPerColumn;
  const left = tracks.slice(0, leftCount);
  const right = tracks.slice(leftCount, leftCount + rightCount);
  return [left, right];
}

// --- ロゴレイアウト ---

export interface LogoBox {
  width: number;
  height: number;
}

/** ロゴ上部の余白 = maxRows=8 時の 1 行高の 1/3 */
export function getLogoTopMargin(canvasHeight: number): number {
  const { rowHeight } = calculateRowHeight(8, canvasHeight);
  return Math.floor(rowHeight / 3);
}

/** 最大ロゴ高さ
 * ロゴ下端を「最終行ボトム」に合わせるアンカーで、
 * maxRows=8 + 最大スライダー時に上余白が 1/3 行になる値:
 *   maxLogoH = 3 * pitch - margin
 * (K=3 のとき K*pitch - margin が上余白計算式となる)
 */
export function getMaxLogoHeight(canvasHeight: number): number {
  const { rowHeight, rowGap } = calculateRowHeight(8, canvasHeight);
  const pitch = rowHeight + rowGap;
  const margin = getLogoTopMargin(canvasHeight);
  return 3 * pitch - margin;
}

/** 最大ロゴ横幅
 * - 2列: 1カラム幅 (右カラム内に中央配置)
 * - 1列 + 16:9 (右寄せ・縮小行): 列幅の半分
 * - 1列 + 7:8 / 9:16 (中央配置): 列幅ぶん (行と競合しない)
 */
export function getMaxLogoWidth(
  canvasWidth: number,
  columnCount: 1 | 2,
  aspectRatio: AspectRatio,
): number {
  const contentW = canvasWidth - CANVAS_PAD_X * 2;
  if (columnCount === 2) {
    return Math.floor((contentW - COL_GAP) / 2);
  }
  if (aspectRatio === '16:9') {
    return Math.floor(contentW / 2);
  }
  return contentW;
}

/** アスペクト比を保ちつつ max box に収めるロゴサイズを返す
 * heightScale = 0..1 で max 高さに対する比率を指定 */
export function computeLogoBox(
  natural: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  columnCount: 1 | 2,
  aspectRatio: AspectRatio,
  heightScale: number,
): LogoBox {
  const maxW = getMaxLogoWidth(canvasWidth, columnCount, aspectRatio);
  const maxH = getMaxLogoHeight(canvasHeight) * heightScale;
  const aspect = natural.width / natural.height || 1;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { width: Math.max(0, Math.floor(w)), height: Math.max(0, Math.floor(h)) };
}

/** ロゴが何行分を覆うかを計算
 * ロゴ下端が最終行ボトムにアンカーされる前提:
 *   K = ceil((logoHeight + topMargin) / pitch)
 */
export function computeLogoRowsOccupied(
  logoHeight: number,
  rowHeight: number,
  rowGap: number,
  topMargin: number,
): number {
  const pitch = rowHeight + rowGap;
  if (pitch <= 0 || logoHeight <= 0) return 0;
  return Math.ceil((logoHeight + topMargin) / pitch);
}

// --- HTML エスケープ ---

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- 行 HTML 生成 ---

function renderRow(track: TrackWithArtwork, index: number): string {
  const num = String(track.number ?? index + 1).padStart(2, "\u00a0");
  const title = esc(track.title ?? "Unknown");
  const artist = esc(track.artist ?? "Unknown");
  const album = track.album ? esc(track.album) : "";
  const sub = album ? `${artist} \u00b7 ${album}` : artist;
  const bpm = track.bpm ? String(Math.round(track.bpm)) : "";
  const time = esc(track.time ?? "");
  const genre = track.genre ? esc(track.genre) : "";
  const isOdd = index % 2 === 0; // 0-indexed, first row = odd visual (#1)
  const bgClass = isOdd ? ' class="row-odd"' : "";

  const artwork = track.artworkUrl
    ? `<img src="${esc(track.artworkUrl)}" alt="" crossorigin="anonymous" />`
    : `<div class="no-art"></div>`;

  return `      <div class="row"${bgClass}>
        <div class="num">${num}</div>
        <div class="art">${artwork}</div>
        <div class="info">
          <div class="title">${title}</div>
          <div class="sub">${sub}</div>
        </div>
        <div class="bpm">${bpm}</div>
        <div class="time">${time}</div>
        ${genre ? `<div class="genre">${genre}</div>` : `<div class="genre-empty"></div>`}
      </div>`;
}

// --- メイン HTML 生成 ---

/**
 * セトリ画像用の自己完結 HTML を生成
 */
export function generateSetlistHTML(
  items: TrackWithArtwork[],
  metadata: SetlistMetadata
): string {
  const layout = calculateLayout(items.length);
  const columns = splitTracks(items, layout);
  const pitch = layout.rowHeight + layout.rowGap;

  // カラム幅計算
  const canvasW = 1600;
  const padX = 24;
  const gap = 16;
  const contentW = canvasW - padX * 2;
  const colW =
    layout.columnCount === 1
      ? contentW
      : Math.floor((contentW - gap) / 2);

  // アートワークサイズ (行高に合わせて少し小さく)
  const artSize = layout.rowHeight - 6;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }

    .canvas {
      width: ${canvasW}px;
      height: 900px;
      background: #0f0f23;
      font-family: 'Inter', 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
      padding: 16px ${padX}px 28px;
      overflow: hidden;
      position: relative;
    }

    /* --- Header --- */
    .header {
      height: 56px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 2px solid #e94560;
      margin-bottom: 12px;
    }
    .header .event {
      font-size: 18px;
      font-weight: 600;
      color: #eee;
    }
    .header .date {
      font-size: 14px;
      color: #888;
      font-family: 'JetBrains Mono', monospace;
    }
    .header .dj {
      font-size: 13px;
      color: #aaa;
      width: 50%;
    }
    .header .total {
      font-size: 12px;
      color: #666;
      text-align: right;
      width: 50%;
    }

    /* --- Columns container --- */
    .columns {
      display: flex;
      gap: ${gap}px;
      height: 788px;
    }
    .column {
      width: ${colW}px;
      display: flex;
      flex-direction: column;
      gap: ${layout.rowGap}px;
    }

    /* --- Row --- */
    .row {
      display: flex;
      align-items: center;
      height: ${layout.rowHeight}px;
      padding: 0 6px;
      border-radius: 4px;
      gap: 6px;
      flex-shrink: 0;
    }
    .row-odd {
      background: #1a1a2e;
    }

    /* --- Row elements --- */
    .num {
      width: 24px;
      text-align: right;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: #888;
      flex-shrink: 0;
    }
    .art {
      width: ${artSize}px;
      height: ${artSize}px;
      flex-shrink: 0;
    }
    .art img {
      width: ${artSize}px;
      height: ${artSize}px;
      border-radius: 4px;
      object-fit: cover;
      display: block;
    }
    .no-art {
      width: ${artSize}px;
      height: ${artSize}px;
      border-radius: 4px;
      background: #252540;
    }
    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1px;
    }
    .title {
      font-size: 13px;
      font-weight: 600;
      color: #eee;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub {
      font-size: 12px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bpm {
      width: 42px;
      text-align: right;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: #e94560;
      flex-shrink: 0;
    }
    .time {
      width: 36px;
      text-align: right;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: #777;
      flex-shrink: 0;
    }
    .genre {
      width: 56px;
      font-size: 12px;
      color: #aaa;
      background: #252540;
      border-radius: 3px;
      padding: 2px 4px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .genre-empty {
      width: 56px;
      flex-shrink: 0;
    }

    /* --- Brand --- */
    .brand {
      position: absolute;
      bottom: 8px;
      right: ${padX}px;
      font-size: 12px;
      color: #444;
      font-family: 'JetBrains Mono', monospace;
    }
  `;

  const columnsHTML = columns
    .map((col, ci) => {
      // 各カラムの先頭インデックスを計算 (番号の奇偶判定用)
      const offset = ci === 0 ? 0 : columns[0].length;
      const rows = col.map((t, i) => renderRow(t, offset + i)).join("\n");
      return `    <div class="column">\n${rows}\n    </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${esc(metadata.eventName)} - Setlist</title>
  <style>${css}
  </style>
</head>
<body style="background:#222; display:flex; justify-content:center; align-items:center; min-height:100vh;">
  <div class="canvas">
    <div class="header">
      <span class="event">${esc(metadata.eventName)}</span>
      <span class="date">${esc(metadata.date)}</span>
      <span class="dj">${esc(metadata.djName)}</span>
      <span class="total">${items.length}曲</span>
    </div>
    <div class="columns">
${columnsHTML}
    </div>
    <div class="brand">setlist-maker</div>
  </div>
</body>
</html>`;
}
