/**
 * Vertical scroll area with a thin overlay scrollbar, after Radix Themes ScrollArea (size 1, type "hover"):
 * 4px wide, 4px from the edge, gray-a3 track and gray-a8 thumb. The native scrollbar is hidden;
 * wheel, touch and keyboard scrolling stay native. The thumb can be dragged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import styles from './ScrollArea.module.css';

const MIN_THUMB = 16; // Radix Themes: min-height var(--space-4)

export function ScrollArea({ className, contentClassName, children }: { className?: string; contentClassName?: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [active, setActive] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ y: number; scrollTop: number } | null>(null);

  const update = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) { setThumb(null); return; }
    const track = clientHeight - 8; // 4px margin top and bottom
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * track);
    const top = 4 + (scrollTop / (scrollHeight - clientHeight)) * (track - height);
    setThumb({ top, height });
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // ResizeObserver also reports the initial size, which sets the first thumb
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (content.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [update]);

  const flash = () => {
    setActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (!drag.current) setActive(false); }, 600);
  };

  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, scrollTop: el.scrollTop };
    setActive(true);
  };
  const onThumbMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el || !drag.current || !thumb) return;
    const track = el.clientHeight - 8 - thumb.height;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, track);
    el.scrollTop = drag.current.scrollTop + (e.clientY - drag.current.y) * ratio;
  };
  const onThumbUp = () => { drag.current = null; flash(); };

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div ref={viewport} className={styles.viewport} onScroll={() => { update(); flash(); }}>
        <div ref={content} className={contentClassName}>{children}</div>
      </div>
      {thumb && (
        <div className={`${styles.scrollbar} ${active ? styles.visible : ''}`} aria-hidden="true">
          <div
            className={styles.thumb}
            style={{ top: thumb.top - 4, height: thumb.height }}
            onPointerDown={onThumbDown}
            onPointerMove={onThumbMove}
            onPointerUp={onThumbUp}
            onPointerCancel={onThumbUp}
          />
        </div>
      )}
    </div>
  );
}
