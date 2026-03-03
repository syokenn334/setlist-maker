import type { TrackWithArtwork, LayoutInfo } from '@core/layout.ts';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: TrackWithArtwork;
  index: number;
  layout: LayoutInfo;
}

export function TrackRow({ track, index, layout }: TrackRowProps) {
  const isOdd = index % 2 === 0; // 0-indexed; first row = visual odd
  const artSize = layout.rowHeight - 6;
  const num = String(track.number ?? index + 1).padStart(2, '\u00a0');
  const artist = track.artist ?? 'Unknown';
  const album = track.album ?? '';
  const sub = album ? `${artist} \u00b7 ${album}` : artist;
  const bpm = track.bpm ? String(Math.round(track.bpm)) : '';

  return (
    <div
      className={`${styles.row} ${isOdd ? styles.rowOdd : ''}`}
      style={{ height: layout.rowHeight }}
    >
      <div className={styles.num}>{num}</div>
      <div className={styles.art} style={{ width: artSize, height: artSize }}>
        {track.artworkUrl ? (
          <img
            className={styles.artImg}
            src={track.artworkUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: artSize, height: artSize }}
          />
        ) : (
          <div className={styles.noArt} style={{ width: artSize, height: artSize }} />
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>{track.title ?? 'Unknown'}</div>
        <div className={styles.sub}>{sub}</div>
      </div>
      <div className={styles.bpm}>{bpm}</div>
      <div className={styles.time}>{track.time ?? ''}</div>
      {track.genre ? (
        <div className={styles.genre}>{track.genre}</div>
      ) : (
        <div className={styles.genreEmpty} />
      )}
    </div>
  );
}
