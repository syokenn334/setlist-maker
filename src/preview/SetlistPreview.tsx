import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { MouseEvent } from 'react';
import { motion } from 'framer-motion';
import type { TrackWithArtwork, LayoutInfo, SetlistMetadata, AspectRatio, LogoBox } from '@core/layout.ts';
import { calculateLayout, calculatePageLayout, splitTracks, CANVAS_SIZES, CANVAS_PAD_X, COL_GAP } from '@core/layout.ts';
import type { SetlistTemplate } from '../templates/index.ts';
import { Canvas } from './Canvas.tsx';
import { Header } from './Header.tsx';
import { Columns, Column } from './Column.tsx';
import { TrackRow } from './TrackRow.tsx';
import { Brand } from './Brand.tsx';
import styles from './SetlistPreview.module.css';

interface SetlistPreviewProps {
  tracks: TrackWithArtwork[];
  metadata: SetlistMetadata;
  template: SetlistTemplate;
  backgroundImage: string | null;
  overlayOpacity: number;
  rowsPerPage?: number;
  columnCount?: 1 | 2;
  aspectRatio?: AspectRatio;
  pageIndex?: number;
  pageCount?: number;
  totalTrackCount?: number;
  globalIndexStart?: number;
  hiddenTracks?: Set<number>;
  onTrackClick?: (globalIndex: number, event: MouseEvent<HTMLDivElement>) => void;
  logoImage?: string | null;
  logoBox?: LogoBox | null;
  logoRowsOccupied?: number;
}

export interface SetlistPreviewHandle {
  getCanvasElement: () => HTMLDivElement | null;
}

const scalerTransition = { type: 'spring' as const, stiffness: 200, damping: 25 };

export const SetlistPreview = forwardRef<SetlistPreviewHandle, SetlistPreviewProps>(
  function SetlistPreview({ tracks, metadata, template, backgroundImage, overlayOpacity, rowsPerPage, columnCount, aspectRatio = '16:9', pageIndex, pageCount, totalTrackCount, globalIndexStart = 0, hiddenTracks, onTrackClick, logoImage, logoBox, logoRowsOccupied = 0 }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const canvasSize = CANVAS_SIZES[aspectRatio];

    useImperativeHandle(ref, () => ({
      getCanvasElement: () => canvasRef.current,
    }));

    const updateScale = useCallback(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const { clientWidth, clientHeight } = wrapper;
      const scaleX = clientWidth / canvasSize.width;
      const scaleY = clientHeight / canvasSize.height;
      setScale(Math.min(scaleX, scaleY));
    }, [canvasSize.width, canvasSize.height]);

    useEffect(() => {
      updateScale();
      const observer = new ResizeObserver(updateScale);
      if (wrapperRef.current) observer.observe(wrapperRef.current);
      return () => observer.disconnect();
    }, [updateScale]);

    const layout: LayoutInfo = rowsPerPage !== undefined
      ? calculatePageLayout(tracks.length, rowsPerPage, columnCount ?? 2, canvasSize.height, logoRowsOccupied)
      : calculateLayout(tracks.length);
    const columns = splitTracks(tracks, layout);

    // 1-column row shrink: only for landscape (16:9). For tall aspects (7:8 / 9:16)
    // overlapping rows are moved to the next page instead (handled in App via tracksPerPage).
    const contentW = canvasSize.width - CANVAS_PAD_X * 2;
    const rightColW = Math.floor((contentW - COL_GAP) / 2);
    const useRowShrink = columnCount === 1 && aspectRatio === '16:9';
    const shrinkColumnRows = useRowShrink && logoBox && logoRowsOccupied > 0 ? logoRowsOccupied : 0;
    const shrunkRowWidth = shrinkColumnRows > 0
      ? Math.floor(contentW / 2)
      : undefined;
    // Logo positioning:
    // - 16:9 (1-col or 2-col): center within the (would-be) right column
    // - 7:8 / 9:16 (1-col): center within the canvas
    const centerInRightCol = aspectRatio === '16:9';
    const centerInCanvas = aspectRatio !== '16:9';

    return (
      <div className={styles.wrapper} ref={wrapperRef}>
        <motion.div
          className={styles.scaler}
          animate={{
            scale,
            width: canvasSize.width,
            height: canvasSize.height,
          }}
          transition={scalerTransition}
        >
          <div ref={canvasRef}>
            <Canvas template={template} backgroundImage={backgroundImage} overlayOpacity={overlayOpacity} width={canvasSize.width} height={canvasSize.height}>
              <Header
                metadata={metadata}
                trackCount={totalTrackCount ?? tracks.length}
                pageIndex={pageIndex}
                pageCount={pageCount}
              />
              <Columns canvasHeight={canvasSize.height}>
                {columns.map((col, ci) => {
                  const offset = ci === 0 ? 0 : columns[0].length;
                  return (
                    <Column key={ci} layout={layout} canvasWidth={canvasSize.width}>
                      {col.map((track, i) => {
                        const inPageIndex = offset + i;
                        const globalIdx = globalIndexStart + inPageIndex;
                        // 1-col: last `shrinkColumnRows` rows are shrunk to make room for the logo
                        const shouldShrink =
                          shrinkColumnRows > 0 && i >= col.length - shrinkColumnRows;
                        return (
                          <TrackRow
                            key={inPageIndex}
                            track={track}
                            index={inPageIndex}
                            globalIndex={globalIdx}
                            hidden={hiddenTracks?.has(globalIdx) ?? false}
                            layout={layout}
                            shrinkWidth={shouldShrink ? shrunkRowWidth : undefined}
                            onClick={(gi, e) => onTrackClick?.(gi, e)}
                          />
                        );
                      })}
                    </Column>
                  );
                })}
              </Columns>
              {logoImage && logoBox && (
                <div
                  className={styles.logo}
                  style={{
                    bottom: 0,
                    width: logoBox.width,
                    height: logoBox.height,
                    ...(centerInCanvas
                      ? { left: '50%', transform: 'translateX(-50%)' }
                      : centerInRightCol
                      ? { right: Math.max(0, Math.floor((rightColW - logoBox.width) / 2)) }
                      : { right: 0 }),
                  }}
                >
                  <img
                    src={logoImage}
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              <Brand />
            </Canvas>
          </div>
        </motion.div>
      </div>
    );
  }
);
