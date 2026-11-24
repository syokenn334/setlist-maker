import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '../core/parser.ts';
import type { TrackWithArtwork } from '../types/index.ts';
import { fetchArtwork } from '../core/artwork.ts';

interface ArtworkFetcherState {
  tracks: TrackWithArtwork[];
  progress: number; // 0..total
  total: number;
  isFetching: boolean;
}

const EMPTY: ArtworkFetcherState = { tracks: [], progress: 0, total: 0, isFetching: false };

/**
 * Fetches artwork for every track in order (requests are throttled in core/artwork.ts).
 * `retry` re-runs only the tracks whose artwork was not found.
 */
export function useArtworkFetcher() {
  const [state, setState] = useState<ArtworkFetcherState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback((initial: TrackWithArtwork[], indexes: number[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const tracks = initial.map((t, i) => (indexes.includes(i) ? { ...t, artworkMatch: 'pending' as const } : t));
    setState({ tracks: [...tracks], progress: 0, total: indexes.length, isFetching: indexes.length > 0 });

    (async () => {
      for (let n = 0; n < indexes.length; n++) {
        if (controller.signal.aborted) return;
        const i = indexes[n];
        const { artist = '', title = '' } = tracks[i];
        try {
          const result = await fetchArtwork(artist, title);
          if (controller.signal.aborted) return;
          tracks[i] = { ...tracks[i], artworkUrl: result.url, artworkMatch: result.match };
        } catch {
          tracks[i] = { ...tracks[i], artworkMatch: 'none' };
        }
        if (controller.signal.aborted) return;
        setState({ tracks: [...tracks], progress: n + 1, total: indexes.length, isFetching: n < indexes.length - 1 });
      }
    })();
  }, []);

  const start = useCallback((parsed: Track[]) => {
    const initial: TrackWithArtwork[] = parsed.map((t) => ({ ...t, artworkUrl: null, artworkMatch: 'pending' }));
    run(initial, initial.map((_, i) => i));
  }, [run]);

  const retryMissing = useCallback(() => {
    setState((prev) => {
      const missing = prev.tracks.map((t, i) => (t.artworkMatch === 'none' ? i : -1)).filter((i) => i >= 0);
      queueMicrotask(() => run(prev.tracks, missing));
      return prev;
    });
  }, [run]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isFetching: false }));
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { ...state, start, retryMissing, abort };
}
