import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SetlistImageProps } from '../image/SetlistImage.tsx';
import { SetlistImage } from '../image/SetlistImage.tsx';
import { IconButton } from '../ui/controls.tsx';
import { ChevronLeft, ChevronRight, Minus, PanelLeftOpen, Plus } from '../ui/icons.tsx';
import { Scaled } from './Scaled.tsx';
import { useFitScale } from '../hooks/useFitScale.ts';
import styles from './PreviewStage.module.css';

const ZOOM_STEP = 1.25;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clamp = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

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
  // null = fit to the stage. Reset whenever the image size changes.
  const [zoomState, setZoomState] = useState<{ size: string; value: number } | null>(null);
  const size = `${w}x${h}`;
  const zoom = zoomState && zoomState.size === size ? zoomState.value : null;
  const scale = zoom ?? fit;
  const setZoom = (v: number | null) => setZoomState(v === null ? null : { size, value: clamp(v) });

  // Ctrl / Cmd + wheel (and trackpad pinch, which browsers report as ctrl + wheel)
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomState({ size, value: clamp(scaleRef.current * Math.exp(-e.deltaY * 0.01)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, size]);

  // Two-finger pinch on touch screens
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoom(pinch.current.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
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
              <IconButton label="縮小" disabled={scale <= ZOOM_MIN} onClick={() => setZoom(scale / ZOOM_STEP)}><Minus /></IconButton>
              <button type="button" className={styles.zoom} title="全体を表示" onClick={() => setZoom(null)}>{Math.round(scale * 100)}%</button>
              <IconButton label="拡大" disabled={scale >= ZOOM_MAX} onClick={() => setZoom(scale * ZOOM_STEP)}><Plus /></IconButton>
            </>
          )}
        </div>
      </div>
      <div
        ref={ref}
        className={`${styles.canvasArea} ${zoom !== null && zoom > fit ? styles.scrollable : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {image && (
          <Scaled width={w} height={h} scale={scale} className={styles.frame}>
            <SetlistImage {...image} />
          </Scaled>
        )}
      </div>
    </div>
  );
}
