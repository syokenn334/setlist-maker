/**
 * ページ分割 (実装計画 1.6「ページ分割の設計」)
 *
 * - 1 ページの容量 = 行数 x カラム数。QR を入れるページは、最後のカラムの末尾 qrRows 行を空ける
 * - 前から詰める。2 カラムは左の列を埋めてから右の列へ
 * - QR は最終ページだけ (qrOnAllPages のときは全ページ)
 * - 前から詰めると最終ページが QR だけになるときだけ、全ページの曲数を均等にする
 */

type PageFillMode = 'fill' | 'even';

export interface PageSlice {
  /** 全体での開始位置 (0 始まり) */
  start: number;
  /** 曲数 */
  count: number;
  /** カラムごとの曲数 */
  columnCounts: number[];
  hasQr: boolean;
}

export interface PaginateOptions {
  total: number;
  rows: number;
  columns: 1 | 2;
  qrRows: number;
  /** QR を入れるか (false なら qrRows は無視) */
  qr: boolean;
  qrOnAllPages?: boolean;
}

function splitColumns(count: number, rows: number, columns: 1 | 2, reserved: number): number[] {
  if (columns === 1) return [count];
  const rightCap = rows - reserved;
  // 左の列を埋めてから右の列へ。右は QR の行を除いた容量まで
  const left = Math.min(rows, count);
  return [left, Math.min(rightCap, count - left)];
}

function counts(o: PaginateOptions, mode: PageFillMode): number[] {
  const cap = o.rows * o.columns;
  const qrSlots = o.qr ? o.qrRows : 0;
  if (o.qr && o.qrOnAllPages) {
    const perPage = cap - qrSlots;
    const pages = Math.max(1, Math.ceil(o.total / perPage));
    if (mode === 'fill') return Array.from({ length: pages }, (_, i) => Math.min(perPage, o.total - i * perPage));
    const base = Math.floor(o.total / pages), extra = o.total % pages;
    return Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
  }
  const pages = Math.max(1, Math.ceil((o.total + qrSlots) / cap));
  if (mode === 'fill') {
    const out = Array.from({ length: pages }, (_, i) => Math.max(0, Math.min(cap, o.total - i * cap)));
    return out;
  }
  // even: distribute (total + qrSlots) slots, then take the QR slots from the last page
  const slots = o.total + qrSlots;
  const base = Math.floor(slots / pages), extra = slots % pages;
  const out = Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
  out[pages - 1] -= qrSlots;
  return out;
}

export function paginate(o: PaginateOptions): PageSlice[] {
  let mode: PageFillMode = 'fill';
  let list = counts(o, mode);
  // fill left the last page without tracks (QR only): fall back to even
  if (mode === 'fill' && o.qr && !o.qrOnAllPages && list[list.length - 1] <= 0 && o.total > 0) {
    mode = 'even';
    list = counts(o, mode);
  }
  const slices: PageSlice[] = [];
  let start = 0;
  list.forEach((count, i) => {
    const last = i === list.length - 1;
    const hasQr = o.qr && (o.qrOnAllPages || last);
    slices.push({ start, count, columnCounts: splitColumns(count, o.rows, o.columns, hasQr ? o.qrRows : 0), hasQr });
    start += count;
  });
  return slices;
}
