import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '@core/parser.ts';
import type { TrackWithArtwork } from '@core/layout.ts';
import { fetchArtwork } from '@core/artwork.ts';

const DELAY_MS = 3200;

interface ArtworkFetcherState {
  tracks: TrackWithArtwork[];
  progress: number; // 0..total
  total: number;
  isFetching: boolean;
}

export function useArtworkFetcher() {
  const [state, setState] = useState<ArtworkFetcherState>({
    tracks: [],
    progress: 0,
    total: 0,
    isFetching: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback((parsedTracks: Track[]) => {
    // Abort any in-flight fetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const tracksWithArt: TrackWithArtwork[] = parsedTracks.map((t) => ({
      ...t,
      artworkUrl: null,
    }));

    setState({
      tracks: tracksWithArt,
      progress: 0,
      total: parsedTracks.length,
      isFetching: true,
    });

    (async () => {
      for (let i = 0; i < parsedTracks.length; i++) {
        if (controller.signal.aborted) return;

        const track = parsedTracks[i];
        const artist = track.artist ?? '';
        const title = track.title ?? '';

        if (artist || title) {
          try {
            const result = await fetchArtwork(artist, title);
            if (controller.signal.aborted) return;
            tracksWithArt[i] = {
              ...tracksWithArt[i],
              artworkUrl: result.url,
              album: tracksWithArt[i].album || result.album || undefined,
            };
          } catch {
            // Fetch failed, keep null
          }
        }

        if (controller.signal.aborted) return;

        setState({
          tracks: [...tracksWithArt],
          progress: i + 1,
          total: parsedTracks.length,
          isFetching: i < parsedTracks.length - 1,
        });

        // Rate-limit delay (skip after last track)
        if (i < parsedTracks.length - 1) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, DELAY_MS);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            }, { once: true });
          });
        }
      }
    })();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isFetching: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return { ...state, start, abort };
}
