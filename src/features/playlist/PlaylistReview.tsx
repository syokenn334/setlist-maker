import { useState } from 'react';
import type { TrackWithArtwork } from '../../types/index.ts';
import type { MatchStatus, PlaylistMatch, PlaylistState } from './types.ts';
import { judge, parseVideoId } from './youtube.ts';
import { Button, Chip } from '../../ui/controls.tsx';
import styles from './Playlist.module.css';

type Filter = 'all' | MatchStatus;

/** Matching results shown in place of the preview (Figma D-B3) */
export function PlaylistReview({ state, onChange, tracks, onClose }: {
  state: PlaylistState;
  onChange: (updater: (p: PlaylistState) => PlaylistState) => void;
  tracks: TrackWithArtwork[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('review');
  const [pasting, setPasting] = useState<number | null>(null);
  const [pasted, setPasted] = useState('');

  const update = (index: number, fn: (m: PlaylistMatch) => PlaylistMatch) =>
    onChange((p) => ({ ...p, matches: p.matches.map((m) => (m.index === index ? fn(m) : m)) }));

  const nextCandidate = (m: PlaylistMatch) => {
    if (m.candidates.length === 0) return;
    const at = m.selected ? m.candidates.findIndex((c) => c.videoId === m.selected!.videoId) : -1;
    const next = m.candidates[(at + 1) % m.candidates.length];
    update(m.index, (x) => ({ ...x, selected: next, status: judge(tracks[x.index], next) === 'ok' ? 'ok' : 'review' }));
  };

  const applyPaste = (m: PlaylistMatch) => {
    const id = parseVideoId(pasted);
    if (!id) return;
    update(m.index, (x) => ({ ...x, selected: { videoId: id, title: pasted.trim(), channel: '', thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }, status: 'ok' }));
    setPasting(null); setPasted('');
  };

  const count = (f: MatchStatus) => state.matches.filter((m) => m.status === f).length;
  const list = state.matches.filter((m) => filter === 'all' || m.status === filter);

  return (
    <div className={styles.review}>
      <div className={styles.reviewHead}>
        <h2 className={styles.reviewTitle}>照合結果</h2>
        <Button variant="ghost" onClick={onClose}>閉じる</Button>
      </div>
      <div className={styles.chips}>
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>すべて</Chip>
        <Chip selected={filter === 'review'} onClick={() => setFilter('review')}>要確認 {count('review')}</Chip>
        <Chip selected={filter === 'none'} onClick={() => setFilter('none')}>なし {count('none')}</Chip>
      </div>
      <ul className={styles.matches}>
        {list.map((m) => {
          const t = tracks[m.index];
          return (
            <li key={m.index} className={styles.match}>
              <span className={`${styles.status} ${m.status === 'ok' ? styles.statusOk : m.status === 'review' ? styles.statusReview : styles.statusNone}`}>{m.status === 'ok' ? '一致' : m.status === 'review' ? '要確認' : 'なし'}</span>
              <span className={styles.trackInfo}>
                <span className={styles.trackTitle}>{t.number ?? m.index + 1}. {t.title}</span>
                <span className={styles.sub}>{t.artist}</span>
              </span>
              <span className={styles.video}>{m.selected?.thumbnail && <img src={m.selected.thumbnail} alt="" />}</span>
              <span className={styles.trackInfo}>
                <span className={m.selected ? '' : styles.sub}>{m.selected?.title ?? '見つかりませんでした'}</span>
                {m.selected?.channel && <span className={styles.sub}>{m.selected.channel}</span>}
              </span>
              {pasting === m.index ? (
                <form className={styles.paste} onSubmit={(e) => { e.preventDefault(); applyPaste(m); }}>
                  <input autoFocus className={styles.pasteInput} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="YouTube の URL" aria-label="動画の URL" />
                  <Button type="submit" variant="secondary" disabled={!parseVideoId(pasted)}>決定</Button>
                </form>
              ) : (
                <span className={styles.matchActions}>
                  <Button variant="ghost" disabled={m.candidates.length < 2} onClick={() => nextCandidate(m)}>候補</Button>
                  <Button variant="ghost" onClick={() => { setPasting(m.index); setPasted(''); }}>URL</Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
