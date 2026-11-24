import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './TrackMenu.module.css';

/** Small menu shown when a row in the preview is clicked. Kept inside the viewport. */
export function TrackMenu({ x, y, hidden, onToggleHidden, onSearch, onClose }: { x: number; y: number; hidden: boolean; onToggleHidden: () => void; onSearch: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - width - 8), top = Math.min(y, window.innerHeight - height - 8);
    if (left !== x || top !== y) setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('resize', close); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className={styles.menu} style={pos} role="menu" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" role="menuitem" className={styles.item} onClick={onToggleHidden}>{hidden ? '表示する' : '非表示にする'}</button>
      <button type="button" role="menuitem" className={styles.item} onClick={onSearch}>ジャケットを差し替える</button>
    </div>,
    document.body,
  );
}
