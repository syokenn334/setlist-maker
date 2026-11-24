import type { Track } from '../core/parser.ts';

/** idle: no file loaded yet / loaded: a setlist is shown (artwork may still be fetching) */
export type AppPhase = 'idle' | 'loaded';

/**
 * アートワークの照合結果 (実装計画「アートワーク照合の改善」)
 * - exact: 表記どおりの曲が見つかった
 * - substitute: remix などが見つからず、原曲などで代用した (アプリ上だけ印を出す)
 * - none: 見つからなかった
 * - pending: 取得前
 */
export type ArtworkMatch = 'exact' | 'substitute' | 'none' | 'pending';

export interface TrackWithArtwork extends Track {
  artworkUrl: string | null;
  artworkMatch: ArtworkMatch;
}

export interface SetlistMetadata {
  eventName: string;
  djName: string;
  date: string;
}
