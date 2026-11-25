/**
 * Shared setlist page (Figma: setlist / 11 共有ページ). Read-only; the data comes from the URL fragment.
 * Artwork appears only for tracks with an iTunes ID, always next to the official iTunes Store badge
 * that links to the track's purchase page (iTunes Search API terms).
 */
import { useEffect, useState } from 'react';
import type { SharedSetlist } from './payload.ts';
import type { StoreEntry } from './itunesLookup.ts';
import { lookupTracks } from './itunesLookup.ts';
import styles from './SharePage.module.css';

// Official artwork from https://marketing.services.apple/itunes-identity-guidelines (do not modify)
const BADGE_SRC = `${import.meta.env.BASE_URL}badges/itunes-store-get-it-on-ja.svg`;
const APP_URL = import.meta.env.BASE_URL;

export function SharePage({ setlist }: { setlist: SharedSetlist }) {
  const [store, setStore] = useState<Map<number, StoreEntry>>(new Map());

  useEffect(() => {
    const ids = setlist.tracks.flatMap((t) => (t.itunesId ? [t.itunesId] : []));
    if (!ids.length) return;
    const controller = new AbortController();
    lookupTracks(ids, controller.signal).then(setStore).catch(() => undefined);
    return () => controller.abort();
  }, [setlist]);

  useEffect(() => {
    document.title = setlist.eventName ? `${setlist.eventName} - SETLIST MAKER` : 'SETLIST MAKER';
  }, [setlist.eventName]);

  const sub = [setlist.date, setlist.djName].filter(Boolean).join(' ・ ');
  const digits = String(setlist.tracks.length).length;
  // Keep the columns aligned: rows without artwork leave the artwork and badge space empty
  const anyStore = store.size > 0;

  return (
    <div className={styles.page}>
      <main className={styles.column}>
        <header className={styles.header}>
          <h1 className={styles.event}>{setlist.eventName || 'Setlist'}</h1>
          <div className={styles.sub}>
            <span>{sub}</span>
            <span className={styles.count}>{setlist.tracks.length} 曲</span>
          </div>
        </header>
        <ol className={styles.list}>
          {setlist.tracks.map((t, i) => {
            const entry = t.itunesId ? store.get(t.itunesId) : undefined;
            return (
              <li key={i} className={styles.row}>
                <span className={styles.number} style={{ width: `${Math.max(2, digits)}ch` }}>{i + 1}</span>
                {entry ? <img className={styles.artwork} src={entry.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : anyStore && <span className={styles.artwork} aria-hidden="true" />}
                <span className={styles.info}>
                  <span className={styles.title}>{t.title || 'Unknown'}</span>
                  <span className={styles.artist}>{t.artist}</span>
                  <span className={styles.metaMobile}>
                    {t.bpm !== null && <span className={styles.bpm}>{Math.round(t.bpm)}</span>}
                    {t.time && <span className={styles.time}>{t.time}</span>}
                  </span>
                </span>
                <span className={styles.metaDesktop}>
                  <span className={styles.bpm}>{t.bpm !== null ? Math.round(t.bpm) : '–'}</span>
                  <span className={styles.time}>{t.time ?? '–'}</span>
                </span>
                {entry ? (
                  <a className={styles.badge} href={entry.storeUrl} target="_blank" rel="noopener noreferrer">
                    <img src={BADGE_SRC} alt={`${t.title} を iTunes Store で入手`} />
                  </a>
                ) : anyStore && <span className={styles.badgeSpace} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        <footer className={styles.footer}>
          {setlist.youtubePlaylist && (
            <a className={styles.link} href={setlist.youtubePlaylist} target="_blank" rel="noopener noreferrer">YouTube プレイリスト</a>
          )}
          <a className={styles.link} href={APP_URL}>SETLIST MAKER で作成</a>
        </footer>
      </main>
    </div>
  );
}

export function InvalidSharePage() {
  return (
    <div className={styles.page}>
      <main className={styles.column}>
        <p className={styles.invalid}>このリンクは開けませんでした</p>
        <a className={styles.link} href={APP_URL}>SETLIST MAKER</a>
      </main>
    </div>
  );
}
