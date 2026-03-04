import type { TrackWithArtwork, LayoutInfo } from '@core/layout.ts';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: TrackWithArtwork;
  index: number;
  layout: LayoutInfo;
}

// Base row height at 18 rows (used as scale reference)
const BASE_ROW_HEIGHT = 42;
const BASE_TITLE_SIZE = 14;
const BASE_SUB_SIZE = 12;

export function TrackRow({ track, index, layout }: TrackRowProps) {
  const isOdd = index % 2 === 0; // 0-indexed; first row = visual odd
  const artSize = layout.rowHeight - 6;
  const num = String(track.number ?? index + 1).padStart(2, '\u00a0');
  const artist = track.artist ?? 'Unknown';
  const album = track.album ?? '';
  const sub = album ? `${artist} \u00b7 ${album}` : artist;
  const bpm = track.bpm ? String(Math.round(track.bpm)) : '\u2013';
  const time = track.time ?? '\u2013';
  const genre = track.genre ?? '\u2013';

  const rawScale = layout.rowHeight / BASE_ROW_HEIGHT;
  const scale = 1 + (rawScale - 1) * 0.35;
  const titleSize = Math.round(BASE_TITLE_SIZE * scale);
  const subSize = Math.round(BASE_SUB_SIZE * scale);

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
        <div className={styles.title} style={{ fontSize: titleSize }}>{track.title ?? 'Unknown'}</div>
        <div className={styles.sub} style={{ fontSize: subSize }}>{sub}</div>
      </div>
      <div className={styles.bpm} style={!track.bpm ? { textAlign: 'center' } : undefined}>{bpm}</div>
      <div className={styles.time} style={!track.time ? { textAlign: 'center' } : undefined}>{time}</div>
      <div className={track.genre ? styles.genre : styles.genreEmpty}>{genre}</div>
    </div>
  );
}
