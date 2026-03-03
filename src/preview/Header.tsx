import type { SetlistMetadata } from '@core/layout.ts';
import styles from './Header.module.css';

interface HeaderProps {
  metadata: SetlistMetadata;
  trackCount: number;
  pageIndex?: number;
  pageCount?: number;
}

export function Header({ metadata, trackCount, pageIndex, pageCount }: HeaderProps) {
  const showPage = pageCount !== undefined && pageCount > 1;

  return (
    <div className={styles.header}>
      <span className={styles.event}>{metadata.eventName}</span>
      <div className={styles.right}>
        <span className={styles.date}>{metadata.date}</span>
        {showPage && (
          <span className={styles.page}>{pageIndex! + 1}/{pageCount}</span>
        )}
      </div>
      <span className={styles.dj}>{metadata.djName}</span>
      <span className={styles.total}>{trackCount}曲</span>
    </div>
  );
}
