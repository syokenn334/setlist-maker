/**
 * アートワーク取得モジュール
 *
 * iTunes Search API で楽曲のアルバムアートワーク URL を取得する
 *
 * - iTunes Search API の制限は「毎分約 20 回」なので、全リクエストを共通の
 *   間隔制御 (throttledFetch) に通す
 * - Deezer API はブラウザからの呼び出しを許可していない (CORS ヘッダーなし) ため使わない
 */

// --- 型定義 ---

export interface ArtworkResult {
  /** アートワークURL (見つからない場合は null) */
  url: string | null;
  /** 取得元 API */
  source: "itunes" | null;
  /** 検索に使ったクエリ */
  query: string;
  /** マッチした曲名 (API側) */
  matchedTitle?: string;
  /** マッチしたアーティスト名 (API側) */
  matchedArtist?: string;
  /** アルバム名 (API側) */
  album?: string;
}

// --- 検索クエリ正規化 ---

/**
 * DJ楽曲の検索ヒット率を上げるためのクエリ正規化
 * 段階的にクエリを緩和していく候補を生成
 */
export function buildSearchQueries(
  artist: string,
  title: string
): string[] {
  const queries: string[] = [];

  // 1. そのまま (artist + title)
  queries.push(`${artist} ${title}`);

  // 2. タイトルからリミックス表記を除去
  const titleNoRemix = title
    .replace(/\s*[[（(][^\]）)]*(?:remix|リミックス)[^\]）)]*[\]）)]/gi, "")
    .replace(/\s*-\s*(?:single|EP)$/i, "")
    .trim();
  if (titleNoRemix !== title) {
    queries.push(`${artist} ${titleNoRemix}`);
  }

  // 3. feat. 除去
  const titleNoFeat = titleNoRemix
    .replace(/\s*[(（]feat\.?\s*[^)）]*[)）]/gi, "")
    .trim();
  if (titleNoFeat !== titleNoRemix) {
    queries.push(`${artist} ${titleNoFeat}`);
  }

  // 4. アーティスト名を最初の一人だけにする
  const primaryArtist = artist.split(/[,、&＆+＋]/)[0].trim();
  if (primaryArtist !== artist) {
    queries.push(`${primaryArtist} ${titleNoFeat || titleNoRemix || title}`);
  }

  // 5. タイトルのみ (最終手段)
  queries.push(title);

  // 重複排除
  return [...new Set(queries)];
}

// --- iTunes Search API ---

/** iTunes Search API: approximately 20 calls per minute -> one request every 3 s */
const ITUNES_MIN_INTERVAL_MS = 3000;
let nextRequestAt = 0;

/** Serializes iTunes requests so they are at least ITUNES_MIN_INTERVAL_MS apart. */
async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const startAt = Math.max(now, nextRequestAt);
  nextRequestAt = startAt + ITUNES_MIN_INTERVAL_MS;
  if (startAt > now) {
    await new Promise((resolve) => setTimeout(resolve, startAt - now));
  }
  return fetch(url);
}

const ITUNES_PARAMS = { entity: "musicTrack", country: "jp", lang: "ja_jp" };

interface ITunesResult {
  resultCount: number;
  results: {
    trackName: string;
    artistName: string;
    collectionName: string;
    artworkUrl100: string;
  }[];
}

export interface ArtworkCandidate {
  /** 600x600 アップスケール URL */
  url: string;
  title: string;
  artist: string;
  album: string;
}

/**
 * iTunes Search API で複数候補を取得 (ジャケット手動差替用)
 */
export async function searchItunesMulti(
  query: string,
  limit = 5,
): Promise<ArtworkCandidate[]> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: query,
    ...ITUNES_PARAMS,
    limit: String(limit),
  })}`;

  try {
    const res = await throttledFetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as ITunesResult;
    return data.results
      .filter((t) => t.artworkUrl100)
      .map((t) => ({
        url: t.artworkUrl100.replace("100x100bb", "600x600bb"),
        title: t.trackName,
        artist: t.artistName,
        album: t.collectionName,
      }));
  } catch {
    return [];
  }
}

/**
 * iTunes Search API でアートワークを検索
 */
export async function searchItunes(query: string): Promise<ArtworkResult | null> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: query,
    ...ITUNES_PARAMS,
    limit: "5",
  })}`;

  try {
    const res = await throttledFetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as ITunesResult;
    if (data.resultCount === 0 || data.results.length === 0) return null;

    const track = data.results[0];
    // 100x100 → 600x600 に置換
    const artworkUrl = track.artworkUrl100.replace("100x100bb", "600x600bb");

    return {
      url: artworkUrl,
      source: "itunes",
      query,
      matchedTitle: track.trackName,
      matchedArtist: track.artistName,
      album: track.collectionName,
    };
  } catch {
    return null;
  }
}

// --- メイン ---

/**
 * 検索クエリを段階的に緩和しながら iTunes でアートワークを探す
 */
export async function fetchArtwork(
  artist: string,
  title: string
): Promise<ArtworkResult> {
  const queries = buildSearchQueries(artist, title);

  for (const query of queries) {
    const result = await searchItunes(query);
    if (result) return result;
  }

  // 見つからない
  return {
    url: null,
    source: null,
    query: queries[0],
  };
}
