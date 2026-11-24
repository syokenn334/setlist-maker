import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackWithArtwork } from '../types/index.ts';
import type { ArtworkCandidate } from '../core/artwork.ts';
import { searchItunesMulti } from '../core/artwork.ts';
import { Button, Modal, Spinner } from '../ui/controls.tsx';
import { Check, Search } from '../ui/icons.tsx';
import type { ArtworkOverride } from '../App.tsx';
import { ScrollArea } from '../ui/ScrollArea.tsx';
import styles from './ArtworkSearchModal.module.css';

export function ArtworkSearchModal({ track, onSelect, onClose }: { track: TrackWithArtwork; onSelect: (o: ArtworkOverride) => void; onClose: () => void }) {
  const initial = `${track.artist ?? ''} ${track.title ?? ''}`.trim();
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<ArtworkCandidate[]>([]);
  const [loading, setLoading] = useState(initial !== '');
  const reqId = useRef(0);

  const start = useCallback((term: string) => {
    const id = ++reqId.current;
    searchItunesMulti(term, 8, track).then((found) => {
      if (id !== reqId.current) return;
      setResults(found);
      setLoading(false);
    });
  }, [track]);

  useEffect(() => { if (initial) start(initial); }, [initial, start]);

  const run = () => { const term = query.trim(); if (!term) return; setLoading(true); start(term); };

  return (
    <Modal
      onClose={onClose}
      title="ジャケットを差し替える"
      header={(
        <div className={styles.current}>
          <span className={`${styles.thumb} ${track.artworkMatch === 'substitute' ? styles.substitute : ''}`}>{track.artworkUrl && <img src={track.artworkUrl} alt="" />}</span>
          <span className={styles.meta}><span className={styles.title}>{track.title ?? 'Unknown'}</span><span className={styles.sub}>{track.artist ?? ''}</span></span>
        </div>
      )}
    >
      <form className={styles.search} onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="アーティスト 曲名" aria-label="検索語" autoFocus />
        <Button type="submit" variant="secondary" disabled={loading || !query.trim()}><Search size={14} />検索</Button>
      </form>
      <ScrollArea className={styles.resultsScroll} gutter>
      <ul className={styles.results} aria-busy={loading}>
        {loading && <li className={styles.loading}><Spinner size={24} label="検索中" /></li>}
        {!loading && results.length === 0 && <li className={styles.empty}>見つかりませんでした</li>}
        {!loading && results.map((r, i) => {
          const used = r.url === track.artworkUrl;
          return (
            <li key={`${r.url}-${i}`}>
              <button type="button" className={`${styles.result} ${i === 0 && r.match === 'exact' ? styles.best : ''}`} onClick={() => onSelect({ url: r.url, match: 'exact' })}>
                <span className={styles.thumb}><img src={r.url} alt="" /></span>
                <span className={styles.meta}><span className={styles.title}>{r.title}</span><span className={styles.sub}>{r.artist} ・ {r.album}</span></span>
                {used && <span className={styles.used} aria-label="使用中"><Check size={12} /></span>}
              </button>
            </li>
          );
        })}
      </ul>
      </ScrollArea>
      <Button variant="ghost" block onClick={() => onSelect({ url: null, match: 'none' })}>ジャケットなし</Button>
    </Modal>
  );
}
