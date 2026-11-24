/**
 * セトリ画像のレイアウト計算モジュール
 *
 * - キャンバスサイズ (アスペクト比ごと) とレイアウト定数を定義する
 * - 1 ページあたりの行数・カラム数から行の高さとカラム分割を計算する
 */

import type { Track } from "./parser";

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
  /** 右カラムの行数 (reservedRows で末尾を空ける時だけ左より少なくなる) */
  rightColumnRows?: number;
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

// --- レイアウト計算 ---

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
  /** 右カラム (1 カラム時は列) の末尾で空けておく行数。QR コードなどの配置用 */
  reservedRows: number = 0,
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

  // 2カラムで末尾を空ける時は右カラムの行数を減らす
  let rightColumnRows: number | undefined;
  if (columnCount === 2 && reservedRows > 0) {
    rightColumnRows = Math.max(0, clamped - reservedRows);
  }

  return { columnCount, rowsPerColumn, rightColumnRows, rowHeight, rowGap };
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
