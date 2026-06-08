import { useState, useEffect, useCallback, useRef } from 'react';
import { searchItunesMulti } from '@core/artwork.ts';
import type { ArtworkCandidate } from '@core/artwork.ts';
import styles from './ArtworkSearchModal.module.css';

interface ArtworkSearchModalProps {
  initialQuery: string;
  onSelect: (candidate: ArtworkCandidate) => void;
  onClose: () => void;
}

export function ArtworkSearchModal({ initialQuery, onSelect, onClose }: ArtworkSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ArtworkCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const reqIdRef = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSearched(true);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setSearched(true);
    const found = await searchItunesMulti(term, 5);
    if (id === reqIdRef.current) {
      setResults(found);
      setLoading(false);
    }
  }, []);

  // Initial search
  useEffect(() => {
    if (initialQuery.trim()) {
      runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>ジャケット検索</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <form
          className={styles.searchRow}
          onSubmit={(e) => { e.preventDefault(); runSearch(query); }}
        >
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="アーティスト 曲名"
            autoFocus
          />
          <button className={styles.searchBtn} type="submit" disabled={loading || !query.trim()}>
            {loading ? '...' : '検索'}
          </button>
        </form>
        <div className={styles.results}>
          {loading && <div className={styles.status}>検索中...</div>}
          {!loading && searched && results.length === 0 && (
            <div className={styles.status}>結果なし</div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={`${r.url}-${i}`}
              className={styles.resultItem}
              onClick={() => onSelect(r)}
              type="button"
            >
              <img className={styles.thumb} src={r.url} alt="" crossOrigin="anonymous" />
              <div className={styles.meta}>
                <div className={styles.metaTitle}>{r.title}</div>
                <div className={styles.metaSub}>{r.artist}</div>
                <div className={styles.metaAlbum}>{r.album}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
