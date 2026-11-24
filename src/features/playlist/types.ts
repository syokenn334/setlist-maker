/**
 * YouTube playlist state (実装計画 1.7). Credentials and the access token live only in this
 * React state: never written to localStorage / sessionStorage / IndexedDB / cookies / URLs.
 */

export type MatchStatus = 'ok' | 'review' | 'none';

export interface VideoCandidate {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export interface PlaylistMatch {
  /** Track index in the setlist */
  index: number;
  status: MatchStatus;
  candidates: VideoCandidate[];
  /** Selected candidate (index into candidates), or a pasted video */
  selected: VideoCandidate | null;
}

export type PlaylistStep = 'credentials' | 'signedIn' | 'searching' | 'review' | 'creating' | 'done';

export interface PlaylistState {
  clientId: string;
  apiKey: string;
  accessToken: string | null;
  account: string | null;
  privacy: 'unlisted' | 'public';
  step: PlaylistStep;
  progress: number;
  matches: PlaylistMatch[];
  createdUrl: string | null;
  qrEnabled: boolean;
  qrOnAllPages: boolean;
  error: string | null;
}

export const INITIAL_PLAYLIST: PlaylistState = {
  clientId: '', apiKey: '', accessToken: null, account: null,
  privacy: 'unlisted', step: 'credentials', progress: 0,
  matches: [], createdUrl: null, qrEnabled: true, qrOnAllPages: false, error: null,
};
