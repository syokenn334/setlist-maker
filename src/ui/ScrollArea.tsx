/**
 * Vertical scroll area with a thin overlay scrollbar, after Radix Themes ScrollArea (size 1, type "hover"):
 * 4px wide, 4px from the edge, gray-a3 track and gray-a8 thumb. The native scrollbar is hidden;
 * wheel, touch and keyboard scrolling stay native. The thumb can be dragged.
 * `gutter` reserves room for the scrollbar while it is shown, for content that reaches the right edge.
 */
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useOverlayScrollbars } from './useOverlayScrollbars.ts';
import { OverlayScrollbars } from './OverlayScrollbars.tsx';
import styles from './ScrollArea.module.css';

export function ScrollArea({ className, contentClassName, gutter = false, children }: { className?: string; contentClassName?: string; gutter?: boolean; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bars = useOverlayScrollbars(viewport, content);

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div ref={viewport} className={styles.viewport} onScroll={bars.onScroll}>
        <div ref={content} className={`${contentClassName ?? ''} ${gutter && bars.thumbs.y ? styles.gutter : ''}`}>{children}</div>
      </div>
      <OverlayScrollbars bars={bars} />
    </div>
  );
}
