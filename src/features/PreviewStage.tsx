import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SetlistImageProps } from '../image/SetlistImage.tsx';
import { SetlistImage } from '../image/SetlistImage.tsx';
import { IconButton } from '../ui/controls.tsx';
import { ChevronLeft, ChevronRight, Minus, PanelLeftOpen, Plus } from '../ui/icons.tsx';
import { useOverlayScrollbars } from '../ui/useOverlayScrollbars.ts';
import { OverlayScrollbars } from '../ui/OverlayScrollbars.tsx';
import { Scaled } from './Scaled.tsx';
import { useFitScale } from '../hooks/useFitScale.ts';
import styles from './PreviewStage.module.css';

const ZOOM_STEP = 1.25;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clamp = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

/**
 * Zoom: buttons, trackpad pinch (ctrl + wheel in Chromium / Firefox, gesture events in Safari),
 * Shift + wheel, two-finger pinch on touch screens. The point under the cursor / fingers stays put.
 * Pan: native scrolling, middle-button drag, one-finger drag on touch screens.
 */
export function PreviewStage({ loaded, dragging, page, pageCount, onPageChange, sidebarOpen, onOpenSidebar, image }: {
  loaded: boolean;
  dragging: boolean;
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  image: SetlistImageProps | null;
}) {
  const w = image?.preset.width ?? 1080, h = image?.preset.height ?? 1350;
  const { ref, scale: fit } = useFitScale(w, h, 24, Infinity);
  const frameRef = useRef<HTMLDivElement>(null);
  const bars = useOverlayScrollbars(ref, frameRef);

  // null = fit to the stage. Reset whenever the image size changes.
  const [zoomState, setZoomState] = useState<{ size: string; value: number } | null>(null);
  const size = `${w}x${h}`;
  const zoom = zoomState && zoomState.size === size ? zoomState.value : null;
  const scale = zoom ?? fit;

  // Keep the anchor point (client coordinates) over the same spot of the image after a zoom
  const anchor = useRef<{ cx: number; cy: number; u: number; v: number } | null>(null);
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const zoomTo = (next: number | null, cx?: number, cy?: number) => {
    const frame = frameRef.current, vp = ref.current;
    if (frame && vp) {
      const r = frame.getBoundingClientRect(), b = vp.getBoundingClientRect();
      const px = cx ?? b.left + b.width / 2, py = cy ?? b.top + b.height / 2;
      anchor.current = { cx: px, cy: py, u: (px - r.left) / r.width, v: (py - r.top) / r.height };
    }
    setZoomState(next === null ? null : { size, value: clamp(next) });
  };

  useLayoutEffect(() => {
    const a = anchor.current, frame = frameRef.current, vp = ref.current;
    anchor.current = null;
    if (!a || !frame || !vp) return;
    const r = frame.getBoundingClientRect();
    vp.scrollLeft += r.left + a.u * r.width - a.cx;
    vp.scrollTop += r.top + a.v * r.height - a.cy;
  }, [scale, ref]);

  // Wheel: ctrl (trackpad pinch) or Shift + wheel zooms smoothly around the cursor
  const zoomToRef = useRef(zoomTo);
  useEffect(() => { zoomToRef.current = zoomTo; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return;
      e.preventDefault();
      // Shift + wheel is reported as horizontal scrolling by some browsers
      const delta = e.deltaY || e.deltaX;
      const k = e.ctrlKey || e.metaKey ? 0.01 : 0.002;
      zoomToRef.current(scaleRef.current * Math.exp(-delta * k), e.clientX, e.clientY);
    };
    // Safari reports trackpad pinch as gesture events
    let gestureStart = 1;
    const onGestureStart = (e: Event) => { e.preventDefault(); gestureStart = scaleRef.current; };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      zoomToRef.current(gestureStart * g.scale, g.clientX, g.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [ref]);

  // Touch: one finger pans, two fingers pinch (and pan with their midpoint). Middle button pans.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; mx: number; my: number } | null>(null);
  const pan = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 1) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // no autoscroll on middle click
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      pan.current = null;
    } else {
      pan.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const vp = ref.current;
    if (!vp) return;
    if (pan.current && !gesture.current) {
      // Capture only once the pointer actually moves, so a tap still reaches the track rows
      if (!vp.hasPointerCapture(e.pointerId)) vp.setPointerCapture(e.pointerId);
      vp.scrollLeft -= e.clientX - pan.current.x;
      vp.scrollTop -= e.clientY - pan.current.y;
      pan.current = { x: e.clientX, y: e.clientY };
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      vp.scrollLeft -= mx - gesture.current.mx;
      vp.scrollTop -= my - gesture.current.my;
      gesture.current = { ...gesture.current, mx, my };
      zoomTo(gesture.current.scale * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.dist), mx, my);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) pan.current = null;
  };

  return (
    <div className={`${styles.stage} ${dragging ? styles.dragging : ''}`}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSide}>
          {!sidebarOpen && <IconButton label="サイドバーを開く" onClick={onOpenSidebar}><PanelLeftOpen /></IconButton>}
        </div>
        {loaded && pageCount > 1 ? (
          <div className={styles.pager}>
            <IconButton label="前のページ" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft /></IconButton>
            <span className={styles.pageText}>{page + 1} / {pageCount}</span>
            <IconButton label="次のページ" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}><ChevronRight /></IconButton>
          </div>
        ) : <span />}
        <div className={`${styles.toolbarSide} ${styles.right}`}>
          {loaded && (
            <>
              <IconButton label="縮小" disabled={scale <= ZOOM_MIN} onClick={() => zoomTo(scale / ZOOM_STEP)}><Minus /></IconButton>
              <button type="button" className={styles.zoom} title="全体を表示" onClick={() => zoomTo(null)}>{Math.round(scale * 100)}%</button>
              <IconButton label="拡大" disabled={scale >= ZOOM_MAX} onClick={() => zoomTo(scale * ZOOM_STEP)}><Plus /></IconButton>
            </>
          )}
        </div>
      </div>
      <div className={styles.canvasWrap}>
        <div
          ref={ref}
          className={styles.canvasArea}
          onScroll={bars.onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onAuxClick={(e) => { if (e.button === 1) e.preventDefault(); }}
        >
          {image && (
            <div ref={frameRef} className={styles.frameWrap}>
              <Scaled width={w} height={h} scale={scale} className={styles.frame}>
                <SetlistImage {...image} />
              </Scaled>
            </div>
          )}
        </div>
        <OverlayScrollbars bars={bars} />
      </div>
    </div>
  );
}
