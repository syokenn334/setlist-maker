import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseFile } from '@core/parser.ts';
import type { Track } from '@core/parser.ts';
import type { SetlistMetadata, TrackWithArtwork, AspectRatio, LogoBox } from '@core/layout.ts';
import { CANVAS_SIZES, calculateRowHeight, computeLogoBox, computeLogoRowsOccupied, getLogoTopMargin } from '@core/layout.ts';
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
import { LogoUploader } from './components/LogoUploader/LogoUploader.tsx';
import { LogoHeightSlider } from './components/LogoHeightSlider/LogoHeightSlider.tsx';
import { ArtworkSearchModal } from './components/ArtworkSearchModal/ArtworkSearchModal.tsx';
import type { ArtworkCandidate } from '@core/artwork.ts';
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
  const [hiddenTracks, setHiddenTracks] = useState<Set<number>>(new Set());
  const [artworkOverrides, setArtworkOverrides] = useState<Map<number, string>>(new Map());
  const [trackMenu, setTrackMenu] = useState<{ globalIndex: number; x: number; y: number } | null>(null);
  const [searchModal, setSearchModal] = useState<{ globalIndex: number } | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoNatural, setLogoNatural] = useState<{ width: number; height: number } | null>(null);
  const [logoHeightScale, setLogoHeightScale] = useState(1.0);

  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const previewRef = useRef<SetlistPreviewHandle>(null);
  const artworkFetcher = useArtworkFetcher();
  const { exporting, exportPng, exportAllPages } = useExport();

  // Derive display tracks: during/after fetching use artwork data, else bare tracks
  // Apply per-track artwork overrides (manual jacket selection)
  const [bareTracks, setBareTracks] = useState<TrackWithArtwork[]>([]);
  const displayTracks: TrackWithArtwork[] = useMemo(() => {
    const base = phase === 'idle'
      ? []
      : artworkFetcher.tracks.length > 0
        ? artworkFetcher.tracks
        : bareTracks;
    if (artworkOverrides.size === 0) return base;
    return base.map((t, i) => {
      const url = artworkOverrides.get(i);
      return url ? { ...t, artworkUrl: url } : t;
    });
  }, [phase, artworkFetcher.tracks, bareTracks, artworkOverrides]);

  const canvasSize = CANVAS_SIZES[aspectRatio];

  // Logo box (aspect-fit within max constraints)
  const logoBox: LogoBox | null = useMemo(() => {
    if (!logoImage || !logoNatural) return null;
    return computeLogoBox(logoNatural, canvasSize.width, canvasSize.height, columnCount, aspectRatio, logoHeightScale);
  }, [logoImage, logoNatural, canvasSize, columnCount, aspectRatio, logoHeightScale]);

  // Rows the logo covers (logo height + 1/3-row top margin)
  const logoRowsOccupied = useMemo(() => {
    if (!logoBox) return 0;
    const { rowHeight, rowGap } = calculateRowHeight(rowsPerPage, canvasSize.height);
    const topMargin = getLogoTopMargin(canvasSize.height);
    return computeLogoRowsOccupied(logoBox.height, rowHeight, rowGap, topMargin);
  }, [logoBox, rowsPerPage, canvasSize.height]);

  // Page division logic
  // - 2-col + logo: right column capacity reduced
  // - 1-col + 16:9 + logo: full capacity (overlap handled via row shrink)
  // - 1-col + 7:8 or 9:16 + logo: capacity reduced (displaced rows go to next page)
  const maxRows = rowsPerPage;
  const tracksPerPage = (() => {
    if (columnCount === 2) {
      return maxRows + Math.max(0, maxRows - logoRowsOccupied);
    }
    // 1-col
    if (aspectRatio !== '16:9') {
      return Math.max(0, maxRows - logoRowsOccupied);
    }
    return maxRows;
  })();
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
    if (value === '9:16' || value === '7:8') setColumnCount(1);
    setCurrentPage(0);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    artworkFetcher.abort();
    setCurrentPage(0);
    setHiddenTracks(new Set());
    setArtworkOverrides(new Map());
    setTrackMenu(null);
    setSearchModal(null);

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

  const handleLogoUpload = useCallback((dataUrl: string, w: number, h: number) => {
    setLogoImage(dataUrl);
    setLogoNatural({ width: w, height: h });
  }, []);

  const handleLogoClear = useCallback(() => {
    setLogoImage(null);
    setLogoNatural(null);
  }, []);

  const handleTrackClick = useCallback((globalIndex: number, e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setTrackMenu({ globalIndex, x: e.clientX, y: e.clientY });
  }, []);

  const handleToggleHidden = useCallback(() => {
    if (!trackMenu) return;
    setHiddenTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackMenu.globalIndex)) next.delete(trackMenu.globalIndex);
      else next.add(trackMenu.globalIndex);
      return next;
    });
    setTrackMenu(null);
  }, [trackMenu]);

  const handleOpenSearch = useCallback(() => {
    if (!trackMenu) return;
    setSearchModal({ globalIndex: trackMenu.globalIndex });
    setTrackMenu(null);
  }, [trackMenu]);

  const handleSelectArtwork = useCallback((candidate: ArtworkCandidate) => {
    if (!searchModal) return;
    const target = searchModal.globalIndex;
    setArtworkOverrides((prev) => {
      const next = new Map(prev);
      next.set(target, candidate.url);
      return next;
    });
    setSearchModal(null);
  }, [searchModal]);

  useEffect(() => {
    if (!trackMenu) return;
    const close = () => setTrackMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('touchstart', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('touchstart', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [trackMenu]);

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
          {(isMobile || sidebarOpen) && (
            <motion.div
              className={styles.sidebarContent}
              initial={isMobile ? false : { opacity: 0 }}
              animate={isMobile ? undefined : { opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
              exit={isMobile ? undefined : { opacity: 0, transition: { duration: 0.1 } }}
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
                      <div className={styles.sectionTitle}>テーマ</div>
                      <div className={styles.sectionBody}>
                        <TemplatePicker current={template} onChange={setTemplate} />
                      </div>
                    </motion.div>

                    <motion.div className={styles.section} variants={sectionItem}>
                      <div className={styles.sectionTitle}>背景</div>
                      <div className={styles.sectionBody}>
                        <BackgroundUploader
                          hasBackground={backgroundImage !== null}
                          onUpload={setBackgroundImage}
                          onClear={() => setBackgroundImage(null)}
                        />
                        <OverlayOpacitySlider value={overlayOpacity} onChange={setOverlayOpacity} disabled={backgroundImage === null} />
                      </div>
                    </motion.div>

                    <motion.div className={styles.section} variants={sectionItem}>
                      <div className={styles.sectionTitle}>ロゴ</div>
                      <div className={styles.sectionBody}>
                        <LogoUploader
                          hasLogo={logoImage !== null}
                          onUpload={handleLogoUpload}
                          onClear={handleLogoClear}
                        />
                        <LogoHeightSlider
                          value={logoHeightScale}
                          onChange={setLogoHeightScale}
                          disabled={logoImage === null}
                        />
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
              globalIndexStart={currentPage * tracksPerPage}
              hiddenTracks={hiddenTracks}
              onTrackClick={handleTrackClick}
              logoImage={logoImage}
              logoBox={logoBox}
              logoRowsOccupied={logoRowsOccupied}
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

      {trackMenu && (
        <div
          className={styles.trackMenu}
          style={{ left: trackMenu.x, top: trackMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button className={styles.trackMenuItem} onClick={handleToggleHidden}>
            {hiddenTracks.has(trackMenu.globalIndex) ? '再表示' : '非表示'}
          </button>
          <button className={styles.trackMenuItem} onClick={handleOpenSearch}>
            ジャケット検索
          </button>
        </div>
      )}

      {searchModal && (() => {
        const t = displayTracks[searchModal.globalIndex];
        const q = t ? `${t.artist ?? ''} ${t.title ?? ''}`.trim() : '';
        return (
          <ArtworkSearchModal
            initialQuery={q}
            onSelect={handleSelectArtwork}
            onClose={() => setSearchModal(null)}
          />
        );
      })()}
    </div>
  );
}
