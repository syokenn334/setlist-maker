import type { ReactNode } from 'react';
import type { LayoutInfo } from '@core/layout.ts';
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

const PAD_X = 24;
const COL_GAP = 16;
const PADDING_AND_HEADER = 44 + 68;

export function Columns({ canvasHeight, children }: ColumnsProps) {
  const columnsHeight = canvasHeight - PADDING_AND_HEADER;
  return (
    <div className={styles.columns} style={{ gap: COL_GAP, height: columnsHeight }}>
      {children}
    </div>
  );
}

export function Column({ layout, canvasWidth, children }: ColumnProps) {
  const contentW = canvasWidth - PAD_X * 2;
  const colW = layout.columnCount === 1
    ? contentW
    : Math.floor((contentW - COL_GAP) / 2);

  return (
    <div className={styles.column} style={{ width: colW, gap: layout.rowGap }}>
      {children}
    </div>
  );
}
