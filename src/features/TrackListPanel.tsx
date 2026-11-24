import { useState } from 'react';
import type { TrackWithArtwork } from '../types/index.ts';
import { Chip, IconButton } from '../ui/controls.tsx';
import { ChevronLeft, Eye, EyeOff } from '../ui/icons.tsx';
import styles from './TrackListPanel.module.css';

type Filter = 'all' | 'substitute' | 'none' | 'hidden';

export function TrackListPanel({ tracks, hidden, onBack, onToggleHidden, onSearch }: {
  tracks: TrackWithArtwork[];
  hidden: ReadonlySet<number>;
  onBack: () => void;
  onToggleHidden: (index: number) => void;
  onSearch: (index: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = tracks
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) =>
      filter === 'all' ? true
        : filter === 'substitute' ? t.artworkMatch === 'substitute'
          : filter === 'none' ? t.artworkMatch === 'none'
            : hidden.has(i));
  const count = (f: Filter) => (f === 'substitute' ? tracks.filter((t) => t.artworkMatch === 'substitute').length
    : f === 'none' ? tracks.filter((t) => t.artworkMatch === 'none').length
      : f === 'hidden' ? hidden.size : tracks.length);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <IconButton label="戻る" onClick={onBack}><ChevronLeft /></IconButton>
        <span className={styles.title}>曲一覧</span>
      </div>
      <div className={styles.chips} role="group" aria-label="絞り込み">
        {([['all', 'すべて'], ['substitute', '代用'], ['none', 'なし'], ['hidden', '非表示']] as [Filter, string][]).map(([f, label]) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>{label}{f !== 'all' && count(f) > 0 ? ` ${count(f)}` : ''}</Chip>
        ))}
      </div>
      <ul className={styles.list}>
        {visible.map(({ t, i }) => (
          <li key={i} className={styles.item}>
            <button type="button" className={styles.track} onClick={() => onSearch(i)} aria-label={`${t.title ?? ''} のジャケットを差し替える`}>
              <span className={styles.number}>{t.number ?? i + 1}</span>
              <span className={`${styles.art} ${t.artworkMatch === 'substitute' ? styles.substitute : ''} ${t.artworkMatch === 'pending' ? styles.pending : ''}`}>
                {t.artworkUrl && <img src={t.artworkUrl} alt="" />}
              </span>
              <span className={styles.info}>
                <span className={styles.trackTitle}>{t.title ?? 'Unknown'}</span>
                <span className={styles.artist}>{t.artist ?? ''}</span>
              </span>
            </button>
            <IconButton label={hidden.has(i) ? '表示する' : '非表示にする'} onClick={() => onToggleHidden(i)} aria-pressed={hidden.has(i)}>
              {hidden.has(i) ? <EyeOff /> : <Eye />}
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
