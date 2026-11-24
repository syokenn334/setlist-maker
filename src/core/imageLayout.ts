/**
 * 生成画像の寸法計算 (docs/design-system.md 2.1〜2.4, 2.7)
 *
 * - 中身はセーフマージン + 24px の線 (レイアウトの余白) にそろえる。区切り線だけセーフマージン幅
 * - 行: 曲名 24px / アーティスト名 18px の 2 行 (行送り 1.25) がジャケットの高さに収まる
 * - 行の枠 (曲名の枠): ジャケットの上下に ROW_PAD、枠と枠のあいだに ROW_GAP。枠を表示しないときも寸法は同じ
 * - 文字とジャケットの大きさは、1 列 10 曲 (MAX_ROWS) が区切り線と setlist-maker の表記のあいだ
 *   (上下の余白は最小 24px) に収まる大きさで決める。ジャケットは 4 の倍数
 * - 1 列の曲数 (6〜10) を減らしたときは、10 曲分の高さを曲数で等分して 1 曲の枠を大きくする。
 *   文字と数字の大きさ・枠の上下の余白・枠の間隔は 10 曲のときのまま、ジャケットだけ大きくする
 * - QR: 短辺の 22% に最も近い「10 曲のときの行 n つ分」の大きさ。リストの下端にそろえる
 */
import type { CanvasPreset } from './presets.ts';

export const TYPE = { event: 56, headSub: 24, title: 24, sub: 18, credit: 14 } as const;
export const LINE_HEIGHT = 1.25;
export const LAYOUT_INSET = 24;
export const MIN_LIST_GAP = 24;
export const COLUMN_GUTTER = 48;
export const QR_RATIO = 0.22;
export const MAX_ROWS = 10;
export const MIN_ROWS = 6;
export const ROW_PAD = 6;
export const ROW_GAP = 4;

const up = (v: number, unit: number) => Math.ceil(v / unit) * unit;
const lh = (size: number) => Math.ceil(size * LINE_HEIGHT);

/** 曲名とアーティスト名の 2 行の高さ */
export const TEXT_BLOCK = TYPE.title * LINE_HEIGHT + TYPE.sub * LINE_HEIGHT;
/** ジャケット (正方形) の一辺 = 2 行の高さを 8 の倍数に切り上げ */
export const ARTWORK = up(TEXT_BLOCK, 8);
/** 10 曲のときの行の間隔 (基準の大きさ) */
export const PITCH = ARTWORK + ROW_PAD * 2 + ROW_GAP;

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
  /** 行の寸法。band は枠の高さ (ジャケット + 上下の余白)、pitch は行の間隔 */
  artwork: number;
  rowPad: number;
  band: number;
  pitch: number;
  titleSize: number;
  subSize: number;
  textBlock: number;
  /** 10 曲分のリストの高さ */
  listHeight: number;
  columns: 1 | 2;
  columnWidth: number;
  creditY: number;
  qrRows: number;
  qrSize: number;
}

export function computeGeometry(preset: CanvasPreset, columns: 1 | 2, rowsLimit?: number | null): ImageGeometry {
  const { width, height, safeX, safeY } = preset;
  const marginX = safeX + LAYOUT_INSET;
  const marginY = safeY + LAYOUT_INSET;
  const eventY = marginY;
  const subY = eventY + lh(TYPE.event) + 8;
  const dividerY = subY + lh(TYPE.headSub) + 8;
  const dividerBottom = dividerY + 2;
  const creditY = height - marginY - lh(TYPE.credit);
  const available = creditY - dividerBottom;
  const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, rowsLimit ?? MAX_ROWS));
  // 基準の 10 行 (MAX_ROWS * PITCH - ROW_GAP) を k 倍したものが、上下の最小余白を除いた高さに収まる最大の k
  const fit = (available - MIN_LIST_GAP * 2) / (MAX_ROWS * PITCH - ROW_GAP);
  const baseArtwork = Math.floor((ARTWORK * fit) / 4) * 4;
  const k = baseArtwork / ARTWORK;
  const rowPad = Math.round(ROW_PAD * k);
  const rowGap = Math.round(ROW_GAP * k);
  const fullPitch = baseArtwork + rowPad * 2 + rowGap;
  const titleSize = Math.round(TYPE.title * k);
  const subSize = Math.round(TYPE.sub * k);
  const listHeight = MAX_ROWS * fullPitch - rowGap;
  const gapTop = Math.floor((available - listHeight) / 2 / 4) * 4;
  // 10 曲分の高さを曲数で等分し、増えた高さはジャケットに回す
  const pitch = (listHeight + rowGap) / rows;
  const band = pitch - rowGap;
  const artwork = Math.floor(band - rowPad * 2);
  const cols = preset.columns.includes(columns) ? columns : 1;
  const columnWidth = (width - marginX * 2 - COLUMN_GUTTER * (cols - 1)) / cols;
  const short = Math.min(width, height);
  const qrBaseRows = Math.max(1, Math.round((short * QR_RATIO + rowGap) / fullPitch));
  const qrSize = qrBaseRows * fullPitch - rowGap;
  // QR に空ける行数 (この曲数での行間隔で、QR の高さにかかる行)
  const qrRows = Math.min(rows, Math.ceil((qrSize + rowGap) / pitch - 1e-6));
  return {
    width, height, safeX, safeY, marginX, marginY,
    eventY, subY, dividerY,
    listTop: dividerBottom + gapTop,
    rows, artwork, rowPad, band, pitch, titleSize, subSize, listHeight,
    textBlock: (titleSize + subSize) * LINE_HEIGHT,
    columns: cols, columnWidth,
    creditY, qrRows, qrSize,
  };
}
