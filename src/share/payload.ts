/**
 * Shared setlist page: the setlist lives in the URL fragment (`#s=...`), so nothing is stored on a
 * server and the data never reaches one (fragments are not sent in requests).
 *
 * Format: JSON -> deflate (fflate) -> base64url. Decoding is strict: anything that does not match the
 * expected shape and limits is rejected, and every value is rendered as text by React. Links are never
 * taken from the payload (iTunes Store links come from Apple's lookup API, YouTube links must match
 * the playlist URL pattern).
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

export interface SharedTrack {
  title: string;
  artist: string;
  bpm: number | null;
  time: string | null;
  /** iTunes track ID, only for tracks whose artwork was an exact match */
  itunesId: number | null;
}

export interface SharedSetlist {
  eventName: string;
  djName: string;
  date: string;
  tracks: SharedTrack[];
  youtubePlaylist: string | null;
}

const VERSION = 1;
export const SHARE_PREFIX = '#s=';
const MAX_ENCODED = 64 * 1024;
const MAX_TRACKS = 300;
const MAX_TEXT = 300;
const MAX_META = 120;
const TIME = /^\d{1,2}(:\d{2}){1,2}$/;
const YOUTUBE_PLAYLIST = /^https:\/\/www\.youtube\.com\/playlist\?list=[\w-]{10,64}$/;

type Row = [string, string, number | null, string | null, number | null];
interface Wire { v: number; e: string; j: string; d: string; t: Row[]; y?: string }

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeSetlist(s: SharedSetlist): string {
  const wire: Wire = {
    v: VERSION, e: s.eventName.slice(0, MAX_META), j: s.djName.slice(0, MAX_META), d: s.date.slice(0, MAX_META),
    t: s.tracks.map((t) => [
      t.title.slice(0, MAX_TEXT), t.artist.slice(0, MAX_TEXT),
      t.bpm !== null && t.bpm > 0 && t.bpm < 1000 ? t.bpm : null,
      t.time && TIME.test(t.time) ? t.time : null,
      t.itunesId,
    ]),
    // Only a URL the decoder accepts, otherwise the whole link would be rejected
    ...(s.youtubePlaylist && YOUTUBE_PLAYLIST.test(s.youtubePlaylist) ? { y: s.youtubePlaylist } : {}),
  };
  // (the editor always produces data the decoder accepts)
  return SHARE_PREFIX + toBase64Url(deflateSync(strToU8(JSON.stringify(wire)), { level: 9 }));
}

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

/** Returns null for anything malformed (never throws) */
export function decodeSetlist(hash: string): SharedSetlist | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  const encoded = hash.slice(SHARE_PREFIX.length);
  if (!encoded || encoded.length > MAX_ENCODED || !/^[\w-]+$/.test(encoded)) return null;
  let wire: unknown;
  try {
    wire = JSON.parse(strFromU8(inflateSync(fromBase64Url(encoded))));
  } catch {
    return null;
  }
  if (typeof wire !== 'object' || wire === null) return null;
  const w = wire as Partial<Wire>;
  if (w.v !== VERSION || !isText(w.e, MAX_META) || !isText(w.j, MAX_META) || !isText(w.d, MAX_META)) return null;
  if (!Array.isArray(w.t) || w.t.length === 0 || w.t.length > MAX_TRACKS) return null;
  const tracks: SharedTrack[] = [];
  for (const row of w.t) {
    if (!Array.isArray(row) || row.length !== 5) return null;
    const [title, artist, bpm, time, id] = row as unknown[];
    if (!isText(title, MAX_TEXT) || !isText(artist, MAX_TEXT)) return null;
    if (bpm !== null && !(typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0 && bpm < 1000)) return null;
    if (time !== null && !(typeof time === 'string' && TIME.test(time))) return null;
    if (id !== null && !(typeof id === 'number' && Number.isSafeInteger(id) && id > 0)) return null;
    tracks.push({ title, artist, bpm: bpm as number | null, time: time as string | null, itunesId: id as number | null });
  }
  let youtubePlaylist: string | null = null;
  if (w.y !== undefined) {
    if (typeof w.y !== 'string' || !YOUTUBE_PLAYLIST.test(w.y)) return null;
    youtubePlaylist = w.y;
  }
  return { eventName: w.e, djName: w.j, date: w.d, tracks, youtubePlaylist };
}
