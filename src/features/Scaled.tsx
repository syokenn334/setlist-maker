import type { ReactNode } from 'react';

/** Renders children at their logical size and scales them down to `scale`, keeping the box size consistent. */
export function Scaled({ width, height, scale, children, className }: { width: number; height: number; scale: number; children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ width: width * scale, height: height * scale, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  );
}
