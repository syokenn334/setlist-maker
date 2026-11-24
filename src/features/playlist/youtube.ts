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
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(oauthMessage(r.error, r.error_description)))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'ログインが中断されました' : e.type === 'popup_failed_to_open' ? 'ポップアップを開けませんでした' : e.message || 'ログインできませんでした')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function revokeToken(token: string): Promise<void> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (oauth2) await new Promise<void>((r) => oauth2.revoke(token, () => r()));
}

/** Google Identity Services の token エラー (OAuth 2.0 のエラーコード) */
function oauthMessage(error?: string, description?: string): string {
  if (error === 'access_denied') return 'Google アカウントへのアクセスが許可されませんでした';
  if (error === 'invalid_client' || error === 'unauthorized_client') return 'クライアント ID が正しくありません';
  return description || error || 'ログインできませんでした';
}

const GENERIC_FAILURE = 'YouTube API の呼び出しに失敗しました';
const FORBIDDEN = 'YouTube に操作を拒否されました';

export class YouTubeError extends Error {
  readonly status: number;
  readonly reason: string;
  /** トークンが無効 (期限切れ・取り消し)。ログインし直す必要がある */
  readonly authExpired: boolean;
  constructor(message: string, status: number, reason: string) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.authExpired = status === 401 && reason !== 'youtubeSignupRequired';
  }
}

/**
 * HTTP ステータスと reason から利用者向けの文言を決める。
 * reason は YouTube Data API のエラー (https://developers.google.com/youtube/v3/docs/errors) の
 * error.errors[].reason と、Google API 共通の error.details[].reason (ErrorInfo) の両方を見る。
 */
function errorMessage(status: number, reasons: string[]): string {
  const has = (...r: string[]) => r.some((x) => reasons.includes(x));
  if (has('quotaExceeded', 'dailyLimitExceeded')) return 'YouTube API の 1 日の上限に達しました（Google Cloud のプロジェクトごと。太平洋時間の午前 0 時に回復します）';
  if (has('rateLimitExceeded', 'userRateLimitExceeded', 'RATE_LIMIT_EXCEEDED')) return '短時間に呼び出しすぎました。少し待ってから再試行してください';
  if (has('youtubeSignupRequired')) return 'この Google アカウントには YouTube チャンネルがありません。YouTube でチャンネルを作成してから再試行してください';
  if (status === 401) return 'ログインの有効期限が切れました。もう一度ログインしてください';
  if (has('keyInvalid', 'API_KEY_INVALID')) return 'API キーが正しくありません';
  if (has('accessNotConfigured', 'SERVICE_DISABLED')) return 'Google Cloud で YouTube Data API v3 が有効になっていません';
  if (has('ipRefererBlocked', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_SERVICE_BLOCKED')) return 'API キーの制限で、このサイトからの呼び出しが許可されていません';
  if (has('insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')) return 'YouTube の管理の権限が許可されていません。ログインし直して権限を許可してください';
  if (has('maxPlaylistExceeded')) return 'チャンネルのプレイリスト数が上限に達しています';
  if (has('videoNotFound')) return '選んだ動画が見つかりません（削除または非公開の可能性があります）';
  if (has('forbidden')) return FORBIDDEN;
  return GENERIC_FAILURE;
}

async function call<T>(path: string, token: string, apiKey: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  let res: Response;
  try {
    res = await fetch(`${API}/${path}${sep}key=${encodeURIComponent(apiKey)}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new YouTubeError('YouTube に接続できませんでした。ネットワークを確認してください', 0, 'network');
  }
  if (!res.ok) {
    const reasons: string[] = [];
    try {
      const body = await res.json();
      for (const e of body?.error?.errors ?? []) if (e?.reason) reasons.push(e.reason);
      for (const d of body?.error?.details ?? []) if (d?.reason) reasons.push(d.reason);
      if (body?.error?.status) reasons.push(body.error.status);
    } catch { /* body is not JSON */ }
    const message = errorMessage(res.status, reasons);
    // 定型の文言にならなかったときも原因を追えるように、ステータスと reason を添える
    const detail = message === GENERIC_FAILURE || message === FORBIDDEN ? `（${res.status}${reasons[0] ? ` ${reasons[0]}` : ''}）` : '';
    throw new YouTubeError(message + detail, res.status, reasons[0] ?? String(res.status));
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
