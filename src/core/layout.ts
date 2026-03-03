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
  /** 1カラム20行以上の場合は行高を縮小 */
  rowHeight: number;
  rowGap: number;
}

// --- レイアウト計算 ---

/** カラムエリアの利用可能高さ (canvas 900 - padding 44 - header 68) */
const COLUMN_AREA_HEIGHT = 788;

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
): LayoutInfo {
  const clamped = Math.max(10, Math.min(18, maxRows));
  const rowGap = 2;

  // 行高は常に maxRows 基準 (エリアいっぱいに広げる)
  const rowHeight = Math.floor(
    (COLUMN_AREA_HEIGHT - (clamped - 1) * rowGap) / clamped,
  );

  const rowsPerColumn =
    columnCount === 1 ? trackCount : Math.ceil(trackCount / 2);

  return { columnCount, rowsPerColumn, rowHeight, rowGap };
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

  const left = tracks.slice(0, layout.rowsPerColumn);
  const right = tracks.slice(layout.rowsPerColumn);
  return [left, right];
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
      font-size: 10px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bpm {
      width: 42px;
      text-align: right;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #e94560;
      flex-shrink: 0;
    }
    .time {
      width: 36px;
      text-align: right;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #777;
      flex-shrink: 0;
    }
    .genre {
      width: 56px;
      font-size: 9px;
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
      font-size: 10px;
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
