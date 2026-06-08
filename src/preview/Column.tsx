import type { ReactNode } from 'react';
import type { LayoutInfo } from '@core/layout.ts';
import { CANVAS_PAD_X, COL_GAP, getColumnHeight } from '@core/layout.ts';
import styles from './Column.module.css';

interface ColumnsProps {
  canvasHeight: number;
  children: ReactNode;
}

interface ColumnProps {
  layout: LayoutInfo;
  canvasWidth: number;
  children: ReactNode;
}

export function Columns({ canvasHeight, children }: ColumnsProps) {
  const columnsHeight = getColumnHeight(canvasHeight);
  return (
    <div className={styles.columns} style={{ gap: COL_GAP, height: columnsHeight }}>
      {children}
    </div>
  );
}

export function Column({ layout, canvasWidth, children }: ColumnProps) {
  const contentW = canvasWidth - CANVAS_PAD_X * 2;
  const colW = layout.columnCount === 1
    ? contentW
    : Math.floor((contentW - COL_GAP) / 2);

  return (
    <div className={styles.column} style={{ width: colW, gap: layout.rowGap }}>
      {children}
    </div>
  );
}
