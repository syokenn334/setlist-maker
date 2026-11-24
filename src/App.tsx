import { useCallback, useMemo, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { parseFile } from './core/parser.ts';
import type { AppPhase, SetlistMetadata, TrackWithArtwork, ArtworkMatch } from './types/index.ts';
import type { PresetId } from './core/presets.ts';
import { PRESETS } from './core/presets.ts';
import { computeGeometry } from './core/imageLayout.ts';
import { paginate } from './core/pagination.ts';
import type { BackgroundSettings } from './core/background.ts';
import { DEFAULT_BACKGROUND } from './core/background.ts';
import type { ThemeId } from './themes/index.ts';
import { themeById } from './themes/index.ts';
import { useArtworkFetcher } from './hooks/useArtworkFetcher.ts';
import { useQrCode } from './hooks/useQrCode.ts';
import { Sidebar } from './features/Sidebar.tsx';
import type { SidebarView } from './features/Sidebar.tsx';
import { PreviewStage } from './features/PreviewStage.tsx';
import { ArtworkSearchModal } from './features/ArtworkSearchModal.tsx';
import { ExportModal } from './features/ExportModal.tsx';
import { StyleEditor } from './features/StyleEditor.tsx';
import type { EditorTab } from './features/StyleEditor.tsx';
import { TrackMenu } from './features/TrackMenu.tsx';
import { PlaylistReview } from './features/playlist/PlaylistReview.tsx';
import type { PlaylistState } from './features/playlist/types.ts';
import { INITIAL_PLAYLIST } from './features/playlist/types.ts';
import { Toast } from './ui/controls.tsx';
import { Share } from './ui/icons.tsx';
import styles from './App.module.css';

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const isTxt = (name: string) => /\.txt$/i.test(name);

/** Dev only: `?qr=dummy` shows a QR code without the YouTube integration (Phase 9 check) */
const DEV_DUMMY_PLAYLIST = import.meta.env.DEV && new URLSearchParams(location.search).get('qr') === 'dummy'
  ? 'https://www.youtube.com/playlist?list=PLdummy0000000000000000000000000000' : null;

export interface ArtworkOverride { url: string | null; match: Exclude<ArtworkMatch, 'pending'> }

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [metadata, setMetadata] = useState<SetlistMetadata>({ eventName: 'Setlist', djName: 'DJ', date: formatToday() });
  const [presetId, setPresetId] = useState<PresetId>('16:9');
  const [columnsPref, setColumnsPref] = useState<1 | 2>(2);
  const [themeId, setThemeId] = useState<ThemeId>('dark');
  const [background, setBackground] = useState<BackgroundSettings>(DEFAULT_BACKGROUND);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [overrides, setOverrides] = useState<ReadonlyMap<number, ArtworkOverride>>(new Map());
  const [currentPage, setCurrentPage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>('settings');
  const [searchIndex, setSearchIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistState>(INITIAL_PLAYLIST);
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetcher = useArtworkFetcher();
  const theme = themeById(themeId);
  const preset = PRESETS[presetId];
  const columns: 1 | 2 = preset.columns.includes(columnsPref) ? columnsPref : 1;
  const geometry = computeGeometry(preset, columns);
  const rows = geometry.rows;

  const tracks: TrackWithArtwork[] = useMemo(() => {
    if (phase === 'idle') return [];
    if (overrides.size === 0) return fetcher.tracks;
    return fetcher.tracks.map((t, i) => {
      const o = overrides.get(i);
      return o ? { ...t, artworkUrl: o.url, artworkMatch: o.match } : t;
    });
  }, [phase, fetcher.tracks, overrides]);

  const playlistUrl = playlist.createdUrl ?? DEV_DUMMY_PLAYLIST;
  const qrOn = !!playlistUrl && playlist.qrEnabled;
  const qrDataUrl = useQrCode(qrOn ? playlistUrl : null, theme);

  const slices = useMemo(() => paginate({
    total: tracks.length, rows, columns,
    qrRows: geometry.qrRows, qr: qrOn, qrOnAllPages: playlist.qrOnAllPages,
  }), [tracks.length, rows, columns, geometry.qrRows, qrOn, playlist.qrOnAllPages]);
  const pageCount = slices.length;
  const page = Math.min(currentPage, pageCount - 1);

  const substitutes = useMemo(() => new Set(tracks.flatMap((t, i) => (t.artworkMatch === 'substitute' ? [i] : []))), [tracks]);
  const missingCount = tracks.filter((t) => t.artworkMatch === 'none').length;

  const handleFile = useCallback(async (file: File) => {
    if (!isTxt(file.name)) {
      if (phase === 'idle') setDropError('txt ファイルを選んでください'); else setToast('txt ファイルを選んでください');
      return;
    }
    try {
      const result = await parseFile(file);
      if (result.tracks.length === 0) {
        const msg = 'トラックが見つかりませんでした';
        if (phase === 'idle') setDropError(msg); else setToast(msg);
        return;
      }
      fetcher.abort();
      setDropError(null);
      setFileName(file.name);
      setMetadata((prev) => ({ ...prev, eventName: file.name.replace(/\.\w+$/, '') }));
      setHidden(new Set());
      setOverrides(new Map());
      setCurrentPage(0);
      setSidebarView('settings');
      setPlaylist((p) => ({ ...p, createdUrl: null, matches: [] }));
      setPhase('loaded');
      fetcher.start(result.tracks);
    } catch {
      if (phase === 'idle') setDropError('ファイルを読み込めませんでした'); else setToast('ファイルを読み込めませんでした');
    }
  }, [fetcher, phase]);

  const onDragOver = (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } };
  const onDragLeave = (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const toggleHidden = useCallback((index: number) => {
    setHidden((prev) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  }, []);

  const setOverride = useCallback((index: number, o: ArtworkOverride) => {
    setOverrides((prev) => new Map(prev).set(index, o));
  }, []);

  const onTrackClick = useCallback((index: number, e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setMenu({ index, x: e.clientX, y: e.clientY });
  }, []);

  const exportBaseName = `${metadata.eventName || 'setlist'}_${metadata.date.replace(/\D/g, '')}`;
  const loaded = phase === 'loaded' && tracks.length > 0;

  const imageProps = {
    preset, columns, theme, metadata, tracks, hidden, background, qrDataUrl,
  };

  return (
    <div
      className={styles.app}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        view={sidebarView}
        onViewChange={setSidebarView}
        loaded={loaded}
        dragging={dragging}
        dropError={dropError}
        onFile={(f) => void handleFile(f)}
        fileName={fileName}
        fetch={{ progress: fetcher.progress, total: fetcher.total, isFetching: fetcher.isFetching, missing: missingCount, onRetry: fetcher.retryMissing }}
        onExport={() => setExportOpen(true)}
        onOpenEditor={() => setEditorTab('bg')}
        styleThumb={loaded ? { ...imageProps, slice: slices[0], pageIndex: 0, pageCount } : null}
        reviewCount={substitutes.size + missingCount}
        metadata={metadata}
        onMetadataChange={setMetadata}
        presetId={presetId}
        onPresetChange={(id) => { setPresetId(id); setCurrentPage(0); }}
        columns={columns}
        onColumnsChange={(c) => { setColumnsPref(c); setCurrentPage(0); }}
        pageCount={pageCount}
        playlist={playlist}
        onPlaylistChange={setPlaylist}
        tracks={tracks}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        onSearchArtwork={setSearchIndex}
        onOpenReview={() => setReviewOpen(true)}
      />

      <main className={styles.main}>
        {reviewOpen && playlist.matches.length > 0 ? (
          <PlaylistReview state={playlist} onChange={setPlaylist} tracks={tracks} onClose={() => setReviewOpen(false)} />
        ) : (
        <PreviewStage
          loaded={loaded}
          dragging={dragging}
          page={page}
          pageCount={pageCount}
          onPageChange={setCurrentPage}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          image={loaded ? { ...imageProps, slice: slices[page], pageIndex: page, pageCount, substitutes, onTrackClick } : null}
        />
        )}
      </main>

      {loaded && (
        <div className={styles.mobileExport}>
          {/* Mobile: export button fixed at the bottom (desktop uses the sidebar button) */}
          <button type="button" className={styles.mobileExportButton} onClick={() => setExportOpen(true)}><Share size={20} />Export</button>
        </div>
      )}

      {menu && (
        <TrackMenu
          x={menu.x}
          y={menu.y}
          hidden={hidden.has(menu.index)}
          onToggleHidden={() => { toggleHidden(menu.index); setMenu(null); }}
          onSearch={() => { setSearchIndex(menu.index); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}

      {searchIndex !== null && tracks[searchIndex] && (
        <ArtworkSearchModal
          track={tracks[searchIndex]}
          onSelect={(o) => { setOverride(searchIndex, o); setSearchIndex(null); }}
          onClose={() => setSearchIndex(null)}
        />
      )}

      {exportOpen && loaded && (
        <ExportModal
          slices={slices}
          imageProps={imageProps}
          baseName={exportBaseName}
          onClose={() => setExportOpen(false)}
        />
      )}

      {editorTab && loaded && (
        <StyleEditor
          tab={editorTab}
          onTabChange={setEditorTab}
          initial={{ background, themeId, presetId }}
          image={{ ...imageProps, slice: slices[page], pageIndex: page, pageCount }}
          onApply={(d) => {
            setBackground(d.background);
            setThemeId(d.themeId);
            if (d.presetId !== presetId) { setPresetId(d.presetId); setCurrentPage(0); }
            setEditorTab(null);
          }}
          onCancel={() => setEditorTab(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
