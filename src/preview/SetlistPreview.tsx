import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { TrackWithArtwork, LayoutInfo, SetlistMetadata } from '@core/layout.ts';
import { calculateLayout, calculatePageLayout, splitTracks } from '@core/layout.ts';
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
  pageIndex?: number;
  pageCount?: number;
  totalTrackCount?: number;
}

export interface SetlistPreviewHandle {
  getCanvasElement: () => HTMLDivElement | null;
}

export const SetlistPreview = forwardRef<SetlistPreviewHandle, SetlistPreviewProps>(
  function SetlistPreview({ tracks, metadata, template, backgroundImage, rowsPerPage, columnCount, pageIndex, pageCount, totalTrackCount }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useImperativeHandle(ref, () => ({
      getCanvasElement: () => canvasRef.current,
    }));

    const updateScale = useCallback(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const { clientWidth, clientHeight } = wrapper;
      const scaleX = clientWidth / 1600;
      const scaleY = clientHeight / 900;
      setScale(Math.min(scaleX, scaleY));
    }, []);

    useEffect(() => {
      updateScale();
      const observer = new ResizeObserver(updateScale);
      if (wrapperRef.current) observer.observe(wrapperRef.current);
      return () => observer.disconnect();
    }, [updateScale]);

    const layout: LayoutInfo = rowsPerPage !== undefined
      ? calculatePageLayout(tracks.length, rowsPerPage, columnCount ?? 2)
      : calculateLayout(tracks.length);
    const columns = splitTracks(tracks, layout);

    return (
      <div className={styles.wrapper} ref={wrapperRef}>
        <div
          className={styles.scaler}
          style={{
            transform: `scale(${scale})`,
            width: 1600,
            height: 900,
          }}
        >
          <div ref={canvasRef}>
            <Canvas template={template} backgroundImage={backgroundImage}>
              <Header
                metadata={metadata}
                trackCount={totalTrackCount ?? tracks.length}
                pageIndex={pageIndex}
                pageCount={pageCount}
              />
              <Columns>
                {columns.map((col, ci) => {
                  const offset = ci === 0 ? 0 : columns[0].length;
                  return (
                    <Column key={ci} layout={layout}>
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
        </div>
      </div>
    );
  }
);
