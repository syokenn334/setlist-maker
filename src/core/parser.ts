/**
 * rekordbox txt (TSV) Parser
 *
 * - rekordbox のプレイリストエクスポート (txt) を読み込む
 * - UTF-16LE / UTF-16BE / UTF-8 を BOM で自動判定
 * - モック定義の正規カラムと照合し、一致するカラムのみ抽出
 * - ユーザー環境による項目の増減に対応
 */

// --- 正規カラム定義 (モックデータ準拠) ---

export interface CanonicalColumns {
  /** rekordbox ヘッダー名 (日本語) */
  header: string;
  /** 内部キー名 */
  key: string;
}

/**
 * モックデータの項目名を正とする正規カラム定義
 * この配列に含まれる項目名のみがパース対象
 */
export const CANONICAL_COLUMNS: CanonicalColumns[] = [
  { header: "#", key: "number" },
  { header: "トラックタイトル", key: "title" },
  { header: "アーティスト", key: "artist" },
  { header: "アルバム", key: "album" },
  { header: "BPM", key: "bpm" },
  { header: "時間", key: "time" },
  { header: "ジャンル", key: "genre" },
];

// --- Track 型定義 ---

export interface Track {
  number?: number;
  title?: string;
  artist?: string;
  album?: string;
  bpm?: number;
  time?: string;
  genre?: string;
}

// --- パース結果 ---

export interface ParseResult {
  /** パースされたトラック配列 */
  tracks: Track[];
  /** 実際に存在した正規カラム (表示対象) */
  activeColumns: CanonicalColumns[];
  /** 入力にあったが無視されたカラム名 */
  ignoredColumns: string[];
  /** 正規定義にあるが入力に存在しなかったカラム名 */
  missingColumns: string[];
}

// --- エンコーディング判定 & デコード ---

/**
 * BOM (Byte Order Mark) を検出してテキストにデコードする
 * - FF FE → UTF-16LE (rekordbox のデフォルト)
 * - FE FF → UTF-16BE
 * - BOM なし → UTF-8
 */
export function decodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // UTF-16LE BOM: FF FE
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }

  // UTF-16BE BOM: FE FF
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }

  // UTF-8 (BOM あり/なし)
  return new TextDecoder("utf-8").decode(buffer);
}

// --- TSV パーサー ---

/**
 * rekordbox txt ファイルの内容をパースする
 *
 * @param text デコード済みテキスト (decodeBuffer で変換後)
 * @returns パース結果
 */
export function parseSetlist(text: string): ParseResult {
  // BOM 除去 (UTF-8 BOM: \uFEFF)
  const cleaned = text.replace(/^\uFEFF/, "");

  // 行分割 (CR+LF / LF / CR 対応)
  const lines = cleaned.split(/\r?\n|\r/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return {
      tracks: [],
      activeColumns: [],
      ignoredColumns: [],
      missingColumns: CANONICAL_COLUMNS.map((c) => c.header),
    };
  }

  // --- ヘッダー解析 ---
  const headers = lines[0].split("\t").map((h) => h.trim());

  // 正規カラムとの照合: ヘッダー名の完全一致でマッチ
  const canonicalMap = new Map(CANONICAL_COLUMNS.map((c) => [c.header, c]));

  // 入力のカラムインデックス → 正規カラム定義のマッピング
  const columnMapping: { index: number; column: CanonicalColumns }[] = [];
  const ignoredColumns: string[] = [];

  headers.forEach((header, index) => {
    const canonical = canonicalMap.get(header);
    if (canonical) {
      columnMapping.push({ index, column: canonical });
    } else {
      ignoredColumns.push(header);
    }
  });

  // マッチしたカラム
  const activeColumns = columnMapping.map((m) => m.column);
  const activeKeys = new Set(activeColumns.map((c) => c.header));

  // 正規定義にあるが入力に無いカラム
  const missingColumns = CANONICAL_COLUMNS.filter(
    (c) => !activeKeys.has(c.header)
  ).map((c) => c.header);

  // --- データ行パース ---
  const tracks: Track[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split("\t");
    const track: Track = {};

    for (const { index, column } of columnMapping) {
      const value = fields[index]?.trim() ?? "";
      if (value === "") continue;

      switch (column.key) {
        case "number":
          track.number = parseInt(value, 10);
          break;
        case "bpm":
          track.bpm = parseFloat(value);
          break;
        default:
          (track as Record<string, unknown>)[column.key] = value;
          break;
      }
    }

    // 最低限 title か artist があるトラックのみ追加
    if (track.title || track.artist) {
      tracks.push(track);
    }
  }

  return { tracks, activeColumns, ignoredColumns, missingColumns };
}

// --- ファイル読み込みヘルパー (ブラウザ用) ---

/**
 * File オブジェクトから ArrayBuffer を読み込みパースする
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const text = decodeBuffer(buffer);
  return parseSetlist(text);
}
