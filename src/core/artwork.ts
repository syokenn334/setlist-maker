/**
 * アートワーク取得モジュール
 *
 * iTunes Search API (プライマリ) + Deezer API (フォールバック) で
 * 楽曲のアルバムアートワークURLを取得する
 */

// --- 型定義 ---

export interface ArtworkResult {
  /** アートワークURL (見つからない場合は null) */
  url: string | null;
  /** 取得元 API */
  source: "itunes" | "deezer" | null;
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
    .replace(/\s*[\[（(][^\]）)]*(?:remix|リミックス)[^\]）)]*[\]）)]/gi, "")
    .replace(/\s*-\s*(?:single|EP)$/i, "")
    .trim();
  if (titleNoRemix !== title) {
    queries.push(`${artist} ${titleNoRemix}`);
  }

  // 3. feat. 除去
  const titleNoFeat = titleNoRemix
    .replace(/\s*[\(（]feat\.?\s*[^\)）]*[\)）]/gi, "")
    .trim();
  if (titleNoFeat !== titleNoRemix) {
    queries.push(`${artist} ${titleNoFeat}`);
  }

  // 4. アーティスト名を最初の一人だけにする
  const primaryArtist = artist
    .split(/[,、&＆+＋]/)
    [0].trim();
  if (primaryArtist !== artist) {
    queries.push(`${primaryArtist} ${titleNoFeat || titleNoRemix || title}`);
  }

  // 5. タイトルのみ (最終手段)
  queries.push(title);

  // 重複排除
  return [...new Set(queries)];
}

// --- iTunes Search API ---

interface ITunesResult {
  resultCount: number;
  results: {
    trackName: string;
    artistName: string;
    collectionName: string;
    artworkUrl100: string;
  }[];
}

/**
 * iTunes Search API でアートワークを検索
 */
export async function searchItunes(query: string): Promise<ArtworkResult | null> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: query,
    entity: "musicTrack",
    limit: "5",
  })}`;

  try {
    const res = await fetch(url);
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

// --- Deezer API ---

interface DeezerResult {
  data: {
    title: string;
    artist: { name: string };
    album: {
      title: string;
      cover_big: string;
      cover_xl: string;
    };
  }[];
}

/**
 * Deezer API でアートワークを検索
 */
export async function searchDeezer(query: string): Promise<ArtworkResult | null> {
  const url = `https://api.deezer.com/search?${new URLSearchParams({
    q: query,
    limit: "5",
  })}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as DeezerResult;
    if (!data.data || data.data.length === 0) return null;

    const track = data.data[0];
    return {
      url: track.album.cover_xl || track.album.cover_big,
      source: "deezer",
      query,
      matchedTitle: track.title,
      matchedArtist: track.artist.name,
      album: track.album.title,
    };
  } catch {
    return null;
  }
}

// --- メイン: 二段構え検索 ---

/**
 * iTunes → Deezer のフォールバック戦略でアートワークを取得
 * 各APIに対して検索クエリを段階的に緩和して試行
 */
export async function fetchArtwork(
  artist: string,
  title: string
): Promise<ArtworkResult> {
  const queries = buildSearchQueries(artist, title);

  // 1. iTunes で全クエリを試行
  for (const query of queries) {
    const result = await searchItunes(query);
    if (result) return result;
  }

  // 2. Deezer で全クエリを試行 (フォールバック)
  for (const query of queries) {
    const result = await searchDeezer(query);
    if (result) return result;
  }

  // 3. どちらでも見つからない
  return {
    url: null,
    source: null,
    query: queries[0],
  };
}
