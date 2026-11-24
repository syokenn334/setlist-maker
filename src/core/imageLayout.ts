/**
 * 生成画像の寸法計算 (docs/design-system.md 2.1〜2.4)
 *
 * Figma のデザイン (セクション 6) と同じ規則で、論理ピクセルの座標を返す。
 * - 中身はセーフマージン + 24px の線 (レイアウトの余白) にそろえる。区切り線だけセーフマージン幅
 * - 行: 曲名 24px / アーティスト名 18px の 2 行 (行送り 1.25) がジャケットの高さに収まる
 * - 1 列は ROWS_PER_COLUMN 曲で固定。区切り線と setlist-maker の表記のあいだ (上下の余白は最小 24px)
 *   に 10 行が収まるように行 (ジャケット・文字・行間) の大きさを決める。ジャケットは 4 の倍数。
 *   基準 (曲名 24 / アーティスト名 18 / ジャケット 56) より小さくなるのは 16:9 だけ
 * - ページの曲数が 10 より少なくても大きさは変えない
 * - QR: 短辺の 22% に最も近い「行 n つ分」の大きさ
 */
import type { CanvasPreset } from './presets.ts';

export const TYPE = { event: 56, headSub: 24, title: 24, sub: 18, credit: 14 } as const;
export const LINE_HEIGHT = 1.25;
export const LAYOUT_INSET = 24;
export const MIN_LIST_GAP = 24;
export const COLUMN_GUTTER = 48;
export const QR_RATIO = 0.22;
export const ROWS_PER_COLUMN = 10;

const up = (v: number, unit: number) => Math.ceil(v / unit) * unit;
const lh = (size: number) => Math.ceil(size * LINE_HEIGHT);

/** 曲名とアーティスト名の 2 行の高さ */
export const TEXT_BLOCK = TYPE.title * LINE_HEIGHT + TYPE.sub * LINE_HEIGHT;
/** ジャケット (正方形) の一辺 = 2 行の高さを 8 の倍数に切り上げ */
export const ARTWORK = up(TEXT_BLOCK, 8);
/** 行の間隔 */
export const PITCH = ARTWORK + 8;

export interface ImageGeometry {
  width: number;
  height: number;
  safeX: number;
  safeY: number;
  /** レイアウトの余白 (中身の左右 / 上下の線) */
  marginX: number;
  marginY: number;
  eventY: number;
  subY: number;
  dividerY: number;
  listTop: number;
  /** 1 列の曲数 */
  rows: number;
  /** 行の寸法 */
  artwork: number;
  pitch: number;
  titleSize: number;
  subSize: number;
  textBlock: number;
  columns: 1 | 2;
  columnWidth: number;
  creditY: number;
  qrRows: number;
  qrSize: number;
}

export function computeGeometry(preset: CanvasPreset, columns: 1 | 2): ImageGeometry {
  const { width, height, safeX, safeY } = preset;
  const marginX = safeX + LAYOUT_INSET;
  const marginY = safeY + LAYOUT_INSET;
  const eventY = marginY;
  const subY = eventY + lh(TYPE.event) + 8;
  const dividerY = subY + lh(TYPE.headSub) + 8;
  const dividerBottom = dividerY + 2;
  const creditY = height - marginY - lh(TYPE.credit);
  const available = creditY - dividerBottom;
  const rows = ROWS_PER_COLUMN;
  // 基準の行全体 (rows * PITCH - 8) を k 倍したものが、上下の最小余白を除いた高さに収まる最大の k
  const fit = (available - MIN_LIST_GAP * 2) / (rows * PITCH - 8);
  const artwork = Math.floor((ARTWORK * fit) / 4) * 4;
  const k = artwork / ARTWORK;
  const rowGap = Math.round(8 * k);
  const pitch = artwork + rowGap;
  const titleSize = Math.round(TYPE.title * k);
  const subSize = Math.round(TYPE.sub * k);
  const listHeight = rows * pitch - rowGap;
  const gapTop = Math.floor((available - listHeight) / 2 / 4) * 4;
  const cols = preset.columns.includes(columns) ? columns : 1;
  const columnWidth = (width - marginX * 2 - COLUMN_GUTTER * (cols - 1)) / cols;
  const short = Math.min(width, height);
  const qrRows = Math.min(rows, Math.max(1, Math.round((short * QR_RATIO + rowGap) / pitch)));
  return {
    width, height, safeX, safeY, marginX, marginY,
    eventY, subY, dividerY,
    listTop: dividerBottom + gapTop,
    rows, artwork, pitch, titleSize, subSize,
    textBlock: (titleSize + subSize) * LINE_HEIGHT,
    columns: cols, columnWidth,
    creditY, qrRows, qrSize: qrRows * pitch - rowGap,
  };
}
