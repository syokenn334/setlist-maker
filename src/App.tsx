import { useState, useRef, useCallback, useMemo } from 'react';
import { parseFile } from '@core/parser.ts';
import type { Track } from '@core/parser.ts';
import type { SetlistMetadata, TrackWithArtwork, AspectRatio } from '@core/layout.ts';
import { CANVAS_SIZES } from '@core/layout.ts';
import type { AppPhase } from './types/index.ts';
import type { SetlistTemplate } from './templates/index.ts';
import { defaultTemplate } from './templates/index.ts';
import { useArtworkFetcher } from './hooks/useArtworkFetcher.ts';
import { useExport } from './hooks/useExport.ts';
import { DropZone } from './components/DropZone/DropZone.tsx';
import { ProgressBar } from './components/ProgressBar/ProgressBar.tsx';
import { MetadataEditor } from './components/MetadataEditor/MetadataEditor.tsx';
import { TemplatePicker } from './components/TemplatePicker/TemplatePicker.tsx';
import { BackgroundUploader } from './components/BackgroundUploader/BackgroundUploader.tsx';
import { ExportButton } from './components/ExportButton/ExportButton.tsx';
import { RowsPerPageSlider } from './components/RowsPerPageSlider/RowsPerPageSlider.tsx';
import { ColumnCountToggle } from './components/ColumnCountToggle/ColumnCountToggle.tsx';
import { AspectRatioToggle } from './components/AspectRatioToggle/AspectRatioToggle.tsx';
import { PageNav } from './components/PageNav/PageNav.tsx';
import { SetlistPreview } from './preview/SetlistPreview.tsx';
import type { SetlistPreviewHandle } from './preview/SetlistPreview.tsx';
import styles from './App.module.css';

function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SetlistMetadata>({
    eventName: 'Setlist',
    djName: 'DJ',
    date: formatToday(),
  });
  const [template, setTemplate] = useState<SetlistTemplate>(defaultTemplate);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(18);
  const [columnCount, setColumnCount] = useState<1 | 2>(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [currentPage, setCurrentPage] = useState(0);

  const previewRef = useRef<SetlistPreviewHandle>(null);
  const artworkFetcher = useArtworkFetcher();
  const { exporting, exportPng, exportAllPages } = useExport();

  // Derive display tracks: during/after fetching use artwork data, else bare tracks
  const [bareTracks, setBareTracks] = useState<TrackWithArtwork[]>([]);
  const displayTracks: TrackWithArtwork[] =
    phase === 'idle' ? [] : artworkFetcher.tracks.length > 0 ? artworkFetcher.tracks : bareTracks;

  // Page division logic
  const maxRows = rowsPerPage;
  const tracksPerPage = maxRows * columnCount;
  const pageCount = displayTracks.length <= tracksPerPage
    ? 1
    : Math.ceil(displayTracks.length / tracksPerPage);

  const pageTracks = useMemo(() => {
    if (pageCount === 1) return displayTracks;
    const start = currentPage * tracksPerPage;
    return displayTracks.slice(start, start + tracksPerPage);
  }, [displayTracks, currentPage, tracksPerPage, pageCount]);

  // Clamp currentPage when pageCount shrinks
  if (currentPage >= pageCount && pageCount > 0) {
    setCurrentPage(pageCount - 1);
  }

  const handleRowsPerPageChange = useCallback((value: number) => {
    setRowsPerPage(value);
    setCurrentPage(0);
  }, []);

  const handleColumnCountChange = useCallback((value: 1 | 2) => {
    setColumnCount(value);
    if (value === 2) setAspectRatio('16:9');
    setCurrentPage(0);
  }, []);

  const handleAspectRatioChange = useCallback((value: AspectRatio) => {
    setAspectRatio(value);
    if (value === '9:16') setColumnCount(1);
    setCurrentPage(0);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    artworkFetcher.abort();
    setCurrentPage(0);

    try {
      const result = await parseFile(file);
      if (result.tracks.length === 0) {
        setError('トラックが見つかりませんでした。rekordbox txt ファイルを確認してください。');
        return;
      }

      setFileName(file.name);
      const baseName = file.name.replace(/\.\w+$/, '');
      setMetadata((prev) => ({ ...prev, eventName: baseName }));
      const bare: TrackWithArtwork[] = result.tracks.map((t: Track) => ({
        ...t,
        artworkUrl: null,
      }));
      setBareTracks(bare);
      setPhase('fetching');
      artworkFetcher.start(result.tracks);
    } catch {
      setError('ファイルの読み込みに失敗しました。');
    }
  }, [artworkFetcher]);

  // Watch fetcher completion to transition phase
  const prevFetchingRef = useRef(false);
  if (prevFetchingRef.current && !artworkFetcher.isFetching && phase === 'fetching') {
    setPhase('ready');
  }
  prevFetchingRef.current = artworkFetcher.isFetching;

  const buildExportName = useCallback(() => {
    const title = metadata.eventName || 'setlist';
    const dateStr = metadata.date.replace(/\D/g, '');
    return `${title}_${dateStr}`;
  }, [metadata.eventName, metadata.date]);

  const canvasSize = CANVAS_SIZES[aspectRatio];

  const handleExport = useCallback(() => {
    const baseName = buildExportName();
    if (pageCount <= 1) {
      const el = previewRef.current?.getCanvasElement() ?? null;
      exportPng(el, `${baseName}.png`, canvasSize);
    } else {
      exportAllPages(
        () => previewRef.current?.getCanvasElement() ?? null,
        setCurrentPage,
        pageCount,
        baseName,
        canvasSize,
      );
    }
  }, [buildExportName, exportPng, exportAllPages, pageCount, canvasSize]);

  const showPreview = phase !== 'idle' && displayTracks.length > 0;

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>setlist-maker</div>

        <DropZone onFile={handleFile} currentFileName={fileName} />

        {error && <div className={styles.error}>{error}</div>}

        {artworkFetcher.isFetching && (
          <ProgressBar progress={artworkFetcher.progress} total={artworkFetcher.total} />
        )}

        {showPreview && (
          <>
            <div className={styles.section}>
              <MetadataEditor metadata={metadata} onChange={setMetadata} />
            </div>

            <TemplatePicker current={template} onChange={setTemplate} />

            <BackgroundUploader
              hasBackground={backgroundImage !== null}
              onUpload={setBackgroundImage}
              onClear={() => setBackgroundImage(null)}
            />

            <RowsPerPageSlider value={rowsPerPage} onChange={handleRowsPerPageChange} />

            <ColumnCountToggle value={columnCount} onChange={handleColumnCountChange} />

            {columnCount === 1 && (
              <AspectRatioToggle value={aspectRatio} onChange={handleAspectRatioChange} />
            )}

            <PageNav
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
            />

            <div className={styles.spacer} />

            <ExportButton
              disabled={phase !== 'ready'}
              exporting={exporting}
              onClick={handleExport}
            />
          </>
        )}
      </aside>

      <main className={styles.main}>
        {showPreview ? (
          <SetlistPreview
            ref={previewRef}
            tracks={pageTracks}
            metadata={metadata}
            template={template}
            backgroundImage={backgroundImage}
            rowsPerPage={rowsPerPage}
            columnCount={columnCount}
            aspectRatio={aspectRatio}
            pageIndex={currentPage}
            pageCount={pageCount}
            totalTrackCount={displayTracks.length}
          />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Setlist Maker</div>
            <div className={styles.emptyHint}>
              rekordbox txt ファイルをドロップしてセトリ画像を生成
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
