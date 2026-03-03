import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { OverlayOpacitySlider } from './components/OverlayOpacitySlider/OverlayOpacitySlider.tsx';
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

const sidebarVariants = {
  open: {
    width: 'var(--sidebar-width)',
    padding: '20px 16px',
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  closed: {
    width: 52,
    padding: '20px 8px',
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
};

const fadeSlide = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.25 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const sectionStagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const sectionItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

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
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const [rowsPerPage, setRowsPerPage] = useState(18);
  const [columnCount, setColumnCount] = useState<1 | 2>(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [currentPage, setCurrentPage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  useEffect(() => {
    if (currentPage >= pageCount && pageCount > 0) {
      setCurrentPage(pageCount - 1);
    }
  }, [currentPage, pageCount]);

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
  useEffect(() => {
    if (prevFetchingRef.current && !artworkFetcher.isFetching && phase === 'fetching') {
      setPhase('ready');
    }
    prevFetchingRef.current = artworkFetcher.isFetching;
  }, [artworkFetcher.isFetching, phase]);

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
      <motion.aside
        className={styles.sidebar}
        variants={sidebarVariants}
        animate={sidebarOpen ? 'open' : 'closed'}
        initial={false}
      >
        <div className={styles.header}>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                className={styles.logo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                SETLIST MAKER
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            className={styles.toggleBtn}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
            whileTap={{ scale: 0.9 }}
          >
            {sidebarOpen ? '\u00AB' : '\u00BB'}
          </motion.button>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className={styles.sidebarContent}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              <DropZone onFile={handleFile} currentFileName={fileName} />

              <AnimatePresence>
                {showPreview && (
                  <motion.div {...fadeSlide}>
                    <ExportButton
                      disabled={phase !== 'ready'}
                      exporting={exporting}
                      onClick={handleExport}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div
                    className={styles.error}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {artworkFetcher.isFetching && (
                  <motion.div {...fadeSlide}>
                    <ProgressBar progress={artworkFetcher.progress} total={artworkFetcher.total} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    className={styles.sections}
                    variants={sectionStagger}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <motion.div className={styles.section} variants={sectionItem}>
                      <div className={styles.sectionTitle}>メタ情報</div>
                      <div className={styles.sectionBody}>
                        <MetadataEditor metadata={metadata} onChange={setMetadata} />
                      </div>
                    </motion.div>

                    <motion.div className={styles.section} variants={sectionItem}>
                      <div className={styles.sectionTitle}>背景</div>
                      <div className={styles.sectionBody}>
                        <TemplatePicker current={template} onChange={setTemplate} />
                        <BackgroundUploader
                          hasBackground={backgroundImage !== null}
                          onUpload={setBackgroundImage}
                          onClear={() => setBackgroundImage(null)}
                        />
                        <OverlayOpacitySlider value={overlayOpacity} onChange={setOverlayOpacity} disabled={backgroundImage === null} />
                      </div>
                    </motion.div>

                    <motion.div className={styles.section} variants={sectionItem}>
                      <div className={styles.sectionTitle}>レイアウト</div>
                      <div className={styles.sectionBody}>
                        <RowsPerPageSlider value={rowsPerPage} onChange={handleRowsPerPageChange} />
                        <ColumnCountToggle value={columnCount} onChange={handleColumnCountChange} />
                        <AspectRatioToggle
                          value={aspectRatio}
                          onChange={handleAspectRatioChange}
                          disabled={columnCount === 2}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      <main className={styles.main}>
        {showPreview ? (
          <>
            <PageNav
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
            />
            <SetlistPreview
              ref={previewRef}
              tracks={pageTracks}
              metadata={metadata}
              template={template}
              backgroundImage={backgroundImage}
              overlayOpacity={overlayOpacity}
              rowsPerPage={rowsPerPage}
              columnCount={columnCount}
              aspectRatio={aspectRatio}
              pageIndex={currentPage}
              pageCount={pageCount}
              totalTrackCount={displayTracks.length}
            />
          </>
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
