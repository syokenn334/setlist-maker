import { useEffect, useRef, useState } from 'react';

/** Scale that fits a width x height box into the referenced element (never above `max`). */
export function useFitScale(width: number, height: number, padding = 0, max = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const s = Math.min((el.clientWidth - padding * 2) / width, (el.clientHeight - padding * 2) / height, max);
      setScale(Math.max(0.05, s));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, padding, max]);
  return { ref, scale };
}
