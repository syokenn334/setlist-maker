/**
 * アートワーク取得モジュール
 *
 * iTunes Search API で楽曲のアルバムアートワーク URL を取得する
 *
 * - iTunes Search API の制限は「毎分約 20 回」なので、全リクエストを共通の
 *   間隔制御 (throttledFetch) に通す
 * - Deezer API はブラウザからの呼び出しを許可していない (CORS ヘッダーなし) ため使わない
 * - 照合 (実装計画「アートワーク照合の改善」):
 *   - アーティスト名が一致する結果だけを採用する (曲名だけの検索はしない)
 *   - 曲名の括弧書き (remix 名など) まで一致すれば exact、一致しなければ substitute (原曲などで代用)
 */
import type { ArtworkMatch } from '../types/index.ts';

export interface ArtworkResult {
  /** アートワーク URL (見つからない場合は null) */
  url: string | null;
  match: Exclude<ArtworkMatch, 'pending'>;
  /** 検索に使ったクエリ */
  query: string;
  matchedTitle?: string;
  matchedArtist?: string;
  album?: string;
}

// --- 正規化と照合 ---

/** 大文字小文字・空白・記号を無視して比較するための正規化 */
export function normalize(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 曲名の括弧書き ((... Remix), [... Mix], 〜...〜 など) を取り出す */
export function bracketParts(title: string): string[] {
  const parts: string[] = [];
  for (const m of title.matchAll(/[([（【]([^)\]）】]+)[)\]）】]/g)) parts.push(m[1]);
  return parts.filter((p) => !/^feat\.?\s/i.test(p.trim()));
}

/** feat. や括弧書きを除いた曲名 */
export function baseTitle(title: string): string {
  return title
    .replace(/[([（【][^)\]）】]*[)\]）】]/g, '')
    .replace(/\s*-\s*(single|ep)$/i, '')
    .trim();
}

export function primaryArtist(artist: string): string {
  return artist.split(/[,、&＆+＋]|\s(?:feat\.?|ft\.?|x|vs\.?)\s/i)[0].trim();
}

function artistMatches(trackArtist: string, resultArtist: string): boolean {
  const a = normalize(primaryArtist(trackArtist));
  const r = normalize(resultArtist);
  return a.length > 0 && (r.includes(a) || a.includes(r));
}

/** 表記どおり (括弧書きまで一致) なら exact */
function versionMatches(trackTitle: string, resultTitle: string): boolean {
  const parts = bracketParts(trackTitle);
  if (parts.length === 0) return true;
  const r = normalize(resultTitle);
  return parts.every((p) => r.includes(normalize(p)));
}

/** 段階的に緩める検索語 */
export function buildSearchQueries(artist: string, title: string): string[] {
  const queries = [`${artist} ${title}`, `${artist} ${baseTitle(title)}`];
  const primary = primaryArtist(artist);
  if (primary !== artist) queries.push(`${primary} ${baseTitle(title)}`);
  return [...new Set(queries.map((q) => q.trim()))];
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

const ITUNES_PARAMS = { entity: 'musicTrack', country: 'jp', lang: 'ja_jp' };

interface ITunesTrack {
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
}

async function searchItunesRaw(query: string, limit: number): Promise<ITunesTrack[]> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({ term: query, ...ITUNES_PARAMS, limit: String(limit) })}`;
  try {
    const res = await throttledFetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results: ITunesTrack[] };
    return data.results.filter((t) => t.artworkUrl100);
  } catch {
    return [];
  }
}

const big = (url: string) => url.replace('100x100bb', '600x600bb');

export interface ArtworkCandidate {
  /** 600x600 URL */
  url: string;
  title: string;
  artist: string;
  album: string;
  /** 照合先の曲に対する一致の度合い (指定時のみ) */
  match?: Exclude<ArtworkMatch, 'pending'>;
}

/** 手動のジャケット検索用。track を渡すと一致度の高い順に並べる */
export async function searchItunesMulti(
  query: string,
  limit = 8,
  track?: { artist?: string; title?: string },
): Promise<ArtworkCandidate[]> {
  const results = (await searchItunesRaw(query, limit)).map((t) => {
    let match: ArtworkCandidate['match'];
    if (track?.artist && track?.title) {
      match = !artistMatches(track.artist, t.artistName) ? 'none' : versionMatches(track.title, t.trackName) ? 'exact' : 'substitute';
    }
    return { url: big(t.artworkUrl100), title: t.trackName, artist: t.artistName, album: t.collectionName, match };
  });
  const rank = { exact: 0, substitute: 1, none: 2 } as const;
  return track ? results.sort((a, b) => rank[a.match ?? 'none'] - rank[b.match ?? 'none']) : results;
}

/**
 * 検索語を段階的に緩めながら iTunes でアートワークを探す。
 * アーティスト名が一致する結果だけを使い、括弧書きまで一致する結果を優先する。
 */
export async function fetchArtwork(artist: string, title: string): Promise<ArtworkResult> {
  const queries = buildSearchQueries(artist, title);
  let substitute: ArtworkResult | null = null;
  for (const query of queries) {
    const results = await searchItunesRaw(query, 5);
    const sameArtist = results.filter((r) => artistMatches(artist, r.artistName));
    const exact = sameArtist.find((r) => versionMatches(title, r.trackName));
    if (exact) {
      return { url: big(exact.artworkUrl100), match: 'exact', query, matchedTitle: exact.trackName, matchedArtist: exact.artistName, album: exact.collectionName };
    }
    if (sameArtist[0]) {
      // Looser queries only drop the version notation, so they cannot find an exact match: stop here
      const r = sameArtist[0];
      substitute = { url: big(r.artworkUrl100), match: 'substitute', query, matchedTitle: r.trackName, matchedArtist: r.artistName, album: r.collectionName };
      break;
    }
  }
  return substitute ?? { url: null, match: 'none', query: queries[0] };
}
