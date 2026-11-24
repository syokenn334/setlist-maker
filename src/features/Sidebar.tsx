import { useRef, useState } from 'react';
import type { SetlistMetadata, TrackWithArtwork } from '../types/index.ts';
import type { PresetId } from '../core/presets.ts';
import { PRESET_IDS, PRESETS } from '../core/presets.ts';
import type { SetlistImageProps } from '../image/SetlistImage.tsx';
import { SetlistImage } from '../image/SetlistImage.tsx';
import { Button, ErrorText, IconButton, Progress, Section, Segmented, TextInput } from '../ui/controls.tsx';
import { ChevronRight, FileText, PanelLeftClose, RotateCw, Share } from '../ui/icons.tsx';
import { Scaled } from './Scaled.tsx';
import { TrackListPanel } from './TrackListPanel.tsx';
import { PlaylistSection } from './playlist/PlaylistSection.tsx';
import type { PlaylistState } from './playlist/types.ts';
import styles from './Sidebar.module.css';

export type SidebarView = 'settings' | 'tracks';

interface FetchStatus { progress: number; total: number; isFetching: boolean; missing: number; onRetry: () => void }

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  view: SidebarView;
  onViewChange: (v: SidebarView) => void;
  loaded: boolean;
  dragging: boolean;
  dropError: string | null;
  onFile: (file: File) => void;
  fileName: string | null;
  fetch: FetchStatus;
  onExport: () => void;
  onOpenEditor: () => void;
  styleThumb: SetlistImageProps | null;
  reviewCount: number;
  metadata: SetlistMetadata;
  onMetadataChange: (m: SetlistMetadata) => void;
  presetId: PresetId;
  onPresetChange: (id: PresetId) => void;
  columns: 1 | 2;
  onColumnsChange: (c: 1 | 2) => void;
  pageCount: number;
  playlist: PlaylistState;
  onPlaylistChange: (updater: (p: PlaylistState) => PlaylistState) => void;
  tracks: TrackWithArtwork[];
  hidden: ReadonlySet<number>;
  onToggleHidden: (index: number) => void;
  onSearchArtwork: (index: number) => void;
  onOpenReview: () => void;
}

/** Button that opens a file picker (txt only) */
function FileButton({ onFile, variant, children }: { onFile: (f: File) => void; variant: 'primary' | 'ghost'; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} onClick={() => ref.current?.click()}>{children}</Button>
      <input ref={ref} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
  );
}

export function Sidebar(p: SidebarProps) {
  const [open, setOpen] = useState({ meta: true, layout: true, playlist: false });
  const preset = PRESETS[p.presetId];

  if (p.view === 'tracks' && p.loaded) {
    return (
      <aside className={`${styles.sidebar} ${p.open ? '' : styles.closed}`}>
        <TrackListPanel
          tracks={p.tracks}
          hidden={p.hidden}
          onBack={() => p.onViewChange('settings')}
          onToggleHidden={p.onToggleHidden}
          onSearch={p.onSearchArtwork}
        />
      </aside>
    );
  }

  return (
    <aside className={`${styles.sidebar} ${p.open ? '' : styles.closed}`}>
      <div className={styles.header}>
        <IconButton label="サイドバーを閉じる" onClick={p.onToggle} className={styles.toggle}><PanelLeftClose /></IconButton>
        <span className={styles.brand}>SETLIST MAKER</span>
      </div>

      {!p.loaded ? (
        <div className={`${styles.hero} ${p.dragging ? styles.heroActive : ''}`}>
          <span className={styles.heroIcon}><FileText size={24} /></span>
          <span className={styles.heroLabel}>rekordbox の txt をドロップ</span>
          {!p.dragging && <FileButton variant="primary" onFile={p.onFile}>ファイルを選ぶ</FileButton>}
          {p.dropError && <ErrorText>{p.dropError}</ErrorText>}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.fileRow}>
            <span className={styles.fileName} title={p.fileName ?? ''}>{p.fileName}</span>
            <FileButton variant="ghost" onFile={p.onFile}>変更</FileButton>
          </div>

          {p.fetch.isFetching && (
            <div className={styles.progress}>
              <div className={styles.progressHead}><span>アートワーク</span><span>{p.fetch.progress} / {p.fetch.total}</span></div>
              <Progress value={p.fetch.progress} max={p.fetch.total} />
            </div>
          )}
          {!p.fetch.isFetching && p.fetch.missing > 0 && (
            <div className={styles.missing}>
              <span className={styles.missingSquare} aria-hidden="true" />
              <span className={styles.missingText}>{p.fetch.missing} 曲が取得できませんでした</span>
              <Button variant="ghost" onClick={p.fetch.onRetry}><RotateCw size={14} />再試行</Button>
            </div>
          )}

          <div className={styles.export}><Button variant="primary" block onClick={p.onExport}><Share />Export</Button></div>

          <button type="button" className={styles.card} onClick={p.onOpenEditor}>
            {p.styleThumb && (
              <Scaled width={preset.width} height={preset.height} scale={72 / preset.width} className={styles.thumb}>
                <SetlistImage {...p.styleThumb} />
              </Scaled>
            )}
            <span className={styles.cardLabel}>背景・スタイル</span>
            <ChevronRight className={styles.cardChevron} />
          </button>

          <button type="button" className={`${styles.card} ${styles.cardCompact}`} onClick={() => p.onViewChange('tracks')}>
            <span className={styles.cardLabel}>曲一覧</span>
            {p.reviewCount > 0 && (
              <span className={styles.review} aria-label={`代用または未取得 ${p.reviewCount} 曲`}>
                <span className={styles.reviewSquare} aria-hidden="true" />{p.reviewCount}
              </span>
            )}
            <ChevronRight className={styles.cardChevron} />
          </button>

          <Section title="イベント情報" open={open.meta} onToggle={() => setOpen((o) => ({ ...o, meta: !o.meta }))}>
            <TextInput label="イベント名" value={p.metadata.eventName} onChange={(v) => p.onMetadataChange({ ...p.metadata, eventName: v })} />
            <TextInput label="DJ 名" value={p.metadata.djName} onChange={(v) => p.onMetadataChange({ ...p.metadata, djName: v })} />
            <TextInput label="日付" value={p.metadata.date} onChange={(v) => p.onMetadataChange({ ...p.metadata, date: v })} />
          </Section>

          <Section title="レイアウト" open={open.layout} onToggle={() => setOpen((o) => ({ ...o, layout: !o.layout }))}>
            <div className={styles.group}>
              <span className={styles.groupLabel}>サイズ</span>
              <Segmented label="サイズ" value={p.presetId} onChange={p.onPresetChange} options={PRESET_IDS.map((id) => ({ value: id, label: id }))} />
            </div>
            {preset.columns.length > 1 && (
              <div className={styles.group}>
                <span className={styles.groupLabel}>カラム</span>
                <Segmented label="カラム" value={p.columns} onChange={p.onColumnsChange} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
              </div>
            )}
          </Section>

          <Section title="プレイリスト" open={open.playlist} onToggle={() => setOpen((o) => ({ ...o, playlist: !o.playlist }))}>
            <PlaylistSection state={p.playlist} onChange={p.onPlaylistChange} tracks={p.tracks} hidden={p.hidden} eventName={p.metadata.eventName} date={p.metadata.date} onOpenReview={p.onOpenReview} />
          </Section>
        </div>
      )}
    </aside>
  );
}
