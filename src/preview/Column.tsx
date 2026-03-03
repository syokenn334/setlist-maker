import type { ReactNode } from 'react';
import type { LayoutInfo } from '@core/layout.ts';
import styles from './Column.module.css';

interface ColumnsProps {
  children: ReactNode;
}

interface ColumnProps {
  layout: LayoutInfo;
  children: ReactNode;
}

const CANVAS_W = 1600;
const PAD_X = 24;
const COL_GAP = 16;

export function Columns({ children }: ColumnsProps) {
  return (
    <div className={styles.columns} style={{ gap: COL_GAP }}>
      {children}
    </div>
  );
}

export function Column({ layout, children }: ColumnProps) {
  const contentW = CANVAS_W - PAD_X * 2;
  const colW = layout.columnCount === 1
    ? contentW
    : Math.floor((contentW - COL_GAP) / 2);

  return (
    <div className={styles.column} style={{ width: colW, gap: layout.rowGap }}>
      {children}
    </div>
  );
}
