/**
 * YouTube Data API v3 + Google Identity Services token model (実装計画 1.7)
 *
 * - The user brings their own OAuth client ID and API key (quota is counted to their project)
 * - Tokens are obtained in the browser with google.accounts.oauth2.initTokenClient
 * - Nothing is persisted: callers keep credentials and the token in memory only
 */
import type { MatchStatus, VideoCandidate } from './types.ts';
import { baseTitle, bracketParts, normalize, primaryArtist } from '../../core/artwork.ts';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';
export const CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string; message?: string }) => void }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}
declare global { interface Window { google?: { accounts?: { oauth2?: GoogleOAuth2 } } } }

let gisLoading: Promise<GoogleOAuth2> | null = null;

function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('Google Identity Services を読み込めませんでした')));
    s.onerror = () => { gisLoading = null; reject(new Error('Google Identity Services を読み込めませんでした')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export async function requestToken(clientId: string): Promise<string> {
  const oauth2 = await loadGis();
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_SCOPE,
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || 'ログインできませんでした'))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'ログインが中断されました' : e.type === 'popup_failed_to_open' ? 'ポップアップを開けませんでした' : e.message || 'ログインできませんでした')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function revokeToken(token: string): Promise<void> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (oauth2) await new Promise<void>((r) => oauth2.revoke(token, () => r()));
}

export class YouTubeError extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) { super(message); this.reason = reason; }
}

async function call<T>(path: string, token: string, apiKey: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}/${path}${sep}key=${encodeURIComponent(apiKey)}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let reason = String(res.status);
    try { const body = await res.json(); reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? reason; } catch { /* ignore */ }
    const message = reason === 'quotaExceeded' ? 'YouTube API の 1 日の上限に達しました'
      : res.status === 401 ? 'ログインの有効期限が切れました。もう一度ログインしてください'
        : 'YouTube API の呼び出しに失敗しました';
    throw new YouTubeError(message, reason);
  }
  return res.json() as Promise<T>;
}

export async function getChannelTitle(token: string, apiKey: string): Promise<string | null> {
  const r = await call<{ items?: { snippet: { title: string } }[] }>('channels?part=snippet&mine=true', token, apiKey);
  return r.items?.[0]?.snippet.title ?? null;
}

interface SearchItem { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }

const decode = (s: string) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

export async function searchVideos(query: string, token: string, apiKey: string): Promise<VideoCandidate[]> {
  const q = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '5', q: query, videoCategoryId: '10' });
  const r = await call<{ items?: SearchItem[] }>(`search?${q}`, token, apiKey);
  return (r.items ?? []).map((i) => ({
    videoId: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    thumbnail: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? '',
  }));
}

/** ok: base title and artist found, and the version notation (remix etc.) matches / review: otherwise */
export function judge(track: { artist?: string; title?: string }, c: VideoCandidate | undefined): MatchStatus {
  if (!c) return 'none';
  const hay = normalize(`${c.title} ${c.channel}`);
  const title = normalize(baseTitle(track.title ?? ''));
  const artist = normalize(primaryArtist(track.artist ?? ''));
  const versionOk = bracketParts(track.title ?? '').every((p) => hay.includes(normalize(p)));
  return title && hay.includes(title) && (!artist || hay.includes(artist)) && versionOk ? 'ok' : 'review';
}

export async function createPlaylist(title: string, privacy: 'unlisted' | 'public', token: string, apiKey: string): Promise<string> {
  const r = await call<{ id: string }>('playlists?part=snippet,status', token, apiKey, {
    method: 'POST',
    body: JSON.stringify({ snippet: { title, description: 'Created with Setlist Maker' }, status: { privacyStatus: privacy } }),
  });
  return r.id;
}

export async function addToPlaylist(playlistId: string, videoId: string, token: string, apiKey: string): Promise<void> {
  await call('playlistItems?part=snippet', token, apiKey, {
    method: 'POST',
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
  });
}

export const playlistUrl = (id: string) => `https://www.youtube.com/playlist?list=${id}`;

/** Accepts youtu.be / watch?v= / shorts / plain 11-char ids */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}
