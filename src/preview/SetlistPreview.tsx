import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import type { TrackWithArtwork, LayoutInfo, SetlistMetadata, AspectRatio } from '@core/layout.ts';
import { calculateLayout, calculatePageLayout, splitTracks, CANVAS_SIZES } from '@core/layout.ts';
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
  rowsPerPage?: number;
  columnCount?: 1 | 2;
  aspectRatio?: AspectRatio;
  pageIndex?: number;
  pageCount?: number;
  totalTrackCount?: number;
}

export interface SetlistPreviewHandle {
  getCanvasElement: () => HTMLDivElement | null;
}

const scalerTransition = { type: 'spring' as const, stiffness: 200, damping: 25 };

export const SetlistPreview = forwardRef<SetlistPreviewHandle, SetlistPreviewProps>(
  function SetlistPreview({ tracks, metadata, template, backgroundImage, rowsPerPage, columnCount, aspectRatio = '16:9', pageIndex, pageCount, totalTrackCount }, ref) {
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
      ? calculatePageLayout(tracks.length, rowsPerPage, columnCount ?? 2, canvasSize.height)
      : calculateLayout(tracks.length);
    const columns = splitTracks(tracks, layout);

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
            <Canvas template={template} backgroundImage={backgroundImage} width={canvasSize.width} height={canvasSize.height}>
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
                      {col.map((track, i) => (
                        <TrackRow
                          key={offset + i}
                          track={track}
                          index={offset + i}
                          layout={layout}
                        />
                      ))}
                    </Column>
                  );
                })}
              </Columns>
              <Brand />
            </Canvas>
          </div>
        </motion.div>
      </div>
    );
  }
);
