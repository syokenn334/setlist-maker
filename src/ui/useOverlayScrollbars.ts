/**
 * Thumb positions for overlay scrollbars on a scrolling element whose native scrollbars are hidden
 * (Radix Themes ScrollArea size 1: 4px wide, 4px from the edges, min thumb 16px).
 * Wheel, touch and keyboard scrolling stay native; thumbs can be dragged.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

const MARGIN = 4;
const MIN_THUMB = 16;

export interface Thumb { offset: number; size: number }

function axis(scroll: number, total: number, visible: number): Thumb | null {
  if (total <= visible + 1) return null;
  const track = visible - MARGIN * 2;
  const size = Math.max(MIN_THUMB, (visible / total) * track);
  return { offset: (scroll / (total - visible)) * (track - size), size };
}

function measure(el: HTMLElement) {
  return { x: axis(el.scrollLeft, el.scrollWidth, el.clientWidth), y: axis(el.scrollTop, el.scrollHeight, el.clientHeight) };
}

export function useOverlayScrollbars(viewport: RefObject<HTMLElement | null>, content?: RefObject<HTMLElement | null>) {
  const [thumbs, setThumbs] = useState<{ x: Thumb | null; y: Thumb | null }>({ x: null, y: null });
  const [active, setActive] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ axis: 'x' | 'y'; start: number; scroll: number } | null>(null);

  const update = () => { const el = viewport.current; if (el) setThumbs(measure(el)); };

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // ResizeObserver also reports the initial size
    const ro = new ResizeObserver(() => setThumbs(measure(el)));
    ro.observe(el);
    if (content?.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [viewport, content]);

  const flash = () => {
    setActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (!drag.current) setActive(false); }, 600);
  };

  const onScroll = () => { update(); flash(); };

  const thumbHandlers = (axis: 'x' | 'y') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const el = viewport.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { axis, start: axis === 'x' ? e.clientX : e.clientY, scroll: axis === 'x' ? el.scrollLeft : el.scrollTop };
      setActive(true);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const el = viewport.current, d = drag.current, t = thumbs[axis];
      if (!el || !d || d.axis !== axis || !t) return;
      const visible = axis === 'x' ? el.clientWidth : el.clientHeight;
      const total = axis === 'x' ? el.scrollWidth : el.scrollHeight;
      const ratio = (total - visible) / Math.max(1, visible - MARGIN * 2 - t.size);
      const delta = ((axis === 'x' ? e.clientX : e.clientY) - d.start) * ratio;
      if (axis === 'x') el.scrollLeft = d.scroll + delta; else el.scrollTop = d.scroll + delta;
    },
    onPointerUp: () => { drag.current = null; flash(); },
    onPointerCancel: () => { drag.current = null; flash(); },
  });

  return { thumbs, active, onScroll, update, thumbHandlers };
}
