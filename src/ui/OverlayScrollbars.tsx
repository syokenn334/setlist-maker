import type { useOverlayScrollbars } from './useOverlayScrollbars.ts';
import styles from './ScrollArea.module.css';

/** The scrollbar elements for useOverlayScrollbars. Place inside a positioned box that wraps the viewport. */
export function OverlayScrollbars({ bars }: { bars: ReturnType<typeof useOverlayScrollbars> }) {
  const { thumbs, active, thumbHandlers } = bars;
  return (
    <>
      {thumbs.y && (
        <div className={`${styles.scrollbar} ${styles.vertical} ${thumbs.x ? styles.withCorner : ''} ${active ? styles.visible : ''}`} aria-hidden="true">
          <div className={styles.thumb} style={{ top: thumbs.y.offset, height: thumbs.y.size }} {...thumbHandlers('y')} />
        </div>
      )}
      {thumbs.x && (
        <div className={`${styles.scrollbar} ${styles.horizontal} ${thumbs.y ? styles.withCorner : ''} ${active ? styles.visible : ''}`} aria-hidden="true">
          <div className={styles.thumb} style={{ left: thumbs.x.offset, width: thumbs.x.size }} {...thumbHandlers('x')} />
        </div>
      )}
    </>
  );
}
