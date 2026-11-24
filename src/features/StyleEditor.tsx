import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { SetlistImageProps } from '../image/SetlistImage.tsx';
import { SetlistImage } from '../image/SetlistImage.tsx';
import type { PresetId } from '../core/presets.ts';
import { PRESETS, PRESET_IDS } from '../core/presets.ts';
import { computeGeometry } from '../core/imageLayout.ts';
import { paginate } from '../core/pagination.ts';
import type { BackgroundSettings } from '../core/background.ts';
import { DEFAULT_BACKGROUND, ZOOM_MAX, ZOOM_MIN, loadAndDownscale, placeBackground } from '../core/background.ts';
import type { ThemeId } from '../themes/index.ts';
import { THEMES, themeById } from '../themes/index.ts';
import { Button, ErrorText, IconButton, Slider } from '../ui/controls.tsx';
import { ImageIcon, Minus, Palette, Plus } from '../ui/icons.tsx';
import { useFitScale } from '../hooks/useFitScale.ts';
import { Scaled } from './Scaled.tsx';
import styles from './StyleEditor.module.css';

export type EditorTab = 'bg' | 'theme';

export interface StyleDraft { background: BackgroundSettings; themeId: ThemeId; presetId: PresetId }

const MAX_FILE = 20 * 1024 * 1024;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function StyleEditor({ tab, onTabChange, initial, image, onApply, onCancel }: {
  tab: EditorTab;
  onTabChange: (t: EditorTab) => void;
  initial: StyleDraft;
  image: SetlistImageProps;
  onApply: (d: StyleDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StyleDraft>(initial);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = PRESETS[draft.presetId];
  const theme = themeById(draft.themeId);
  const bg = draft.background;
  const { ref: stageRef, scale } = useFitScale(preset.width, preset.height, 48);
  const placement = placeBackground(bg, preset.width, preset.height);

  // Re-paginate for the draft preset so the preview matches what will be applied
  const columns: 1 | 2 = preset.columns.includes(image.columns) ? image.columns : 1;
  const g = computeGeometry(preset, columns);
  const slices = paginate({ total: image.tracks.length, rows: g.rows, columns, qrRows: g.qrRows, qr: false });
  const imgProps: SetlistImageProps = { ...image, preset, columns, theme, background: bg, slice: slices[0], pageIndex: 0, pageCount: slices.length, onTrackClick: undefined };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const setBg = (patch: Partial<BackgroundSettings>) => setDraft((d) => ({ ...d, background: { ...d.background, ...patch } }));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFileError('画像ファイルを選んでください'); return; }
    if (file.size > MAX_FILE) { setFileError('20MB 以下の画像を選んでください'); return; }
    setFileError(null);
    // Keep about the export resolution (long side of the largest output) to keep editing light
    const { src, width, height } = await loadAndDownscale(file, 3200);
    setBg({ src, naturalWidth: width, naturalHeight: height, x: 50, y: 50, zoom: 1 });
  };

  // --- Direct manipulation on the canvas ---
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!placement) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: bg.zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, startX: bg.x, startY: bg.y };
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!placement || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setBg({ zoom: clamp(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist), ZOOM_MIN, ZOOM_MAX) });
      return;
    }
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / scale, dy = (e.clientY - drag.current.y) / scale;
    setBg({
      x: placement.overflowX ? clamp(drag.current.startX - (dx / placement.overflowX) * 100, 0, 100) : bg.x,
      y: placement.overflowY ? clamp(drag.current.startY - (dy / placement.overflowY) * 100, 0, 100) : bg.y,
    });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };
  const onWheel = (e: ReactWheelEvent) => { if (placement) setBg({ zoom: clamp(bg.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), ZOOM_MIN, ZOOM_MAX) }); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!placement) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' && placement.overflowX) setBg({ x: clamp(bg.x - step, 0, 100) });
    else if (e.key === 'ArrowRight' && placement.overflowX) setBg({ x: clamp(bg.x + step, 0, 100) });
    else if (e.key === 'ArrowUp' && placement.overflowY) setBg({ y: clamp(bg.y - step, 0, 100) });
    else if (e.key === 'ArrowDown' && placement.overflowY) setBg({ y: clamp(bg.y + step, 0, 100) });
    else return;
    e.preventDefault();
  };

  const cardScale = 116 / preset.width;

  return createPortal(
    <div className={styles.editor} role="dialog" aria-modal="true" aria-label="背景・スタイル">
      <header className={styles.top}>
        <h2 className={styles.title}>背景・スタイル</h2>
        <select className={styles.preset} aria-label="サイズ" value={draft.presetId} onChange={(e) => setDraft((d) => ({ ...d, presetId: e.target.value as PresetId }))}>
          {PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>キャンセル</Button>
          <Button variant="primary" onClick={() => onApply(draft)}>完了</Button>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.tabs} role="tablist" aria-label="編集する項目">
          {([['bg', '背景', <ImageIcon key="i" size={20} />], ['theme', 'テーマ', <Palette key="p" size={20} />]] as const).map(([key, label, icon]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => onTabChange(key)}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>

        <div ref={stageRef} className={styles.stage}>
          <div className={styles.canvasWrap} style={{ width: preset.width * scale, height: preset.height * scale }}>
            {placement && (
              <img
                className={styles.ghost}
                src={bg.src!}
                alt=""
                style={{ left: placement.left * scale, top: placement.top * scale, width: placement.width * scale, height: placement.height * scale }}
              />
            )}
            <div
              className={`${styles.canvas} ${placement ? styles.draggable : ''}`}
              tabIndex={placement ? 0 : -1}
              aria-label="背景の位置（ドラッグ、矢印キーで移動）"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
            >
              <Scaled width={preset.width} height={preset.height} scale={scale}>
                <SetlistImage {...imgProps} />
              </Scaled>
            </div>
          </div>
          {/* Kept in the layout on the theme tab too, so the preview does not move when switching tabs */}
          <div className={`${styles.zoom} ${placement ? '' : styles.disabled} ${tab === 'bg' ? '' : styles.invisible}`} aria-hidden={tab !== 'bg'}>
              <IconButton label="縮小" disabled={!placement || bg.zoom <= ZOOM_MIN} onClick={() => setBg({ zoom: clamp(bg.zoom / 1.1, ZOOM_MIN, ZOOM_MAX) })}><Minus /></IconButton>
              <input className={styles.zoomRange} type="range" aria-label="ズーム" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={bg.zoom} disabled={!placement} onChange={(e) => setBg({ zoom: Number(e.target.value) })} />
              <IconButton label="拡大" disabled={!placement || bg.zoom >= ZOOM_MAX} onClick={() => setBg({ zoom: clamp(bg.zoom * 1.1, ZOOM_MIN, ZOOM_MAX) })}><Plus /></IconButton>
              <span className={styles.zoomText}>{Math.round(bg.zoom * 100)}%</span>
          </div>
        </div>

        <aside className={styles.panel}>
          {tab === 'bg' ? (
            <>
              <div className={styles.imageRow}>
                <span className={styles.thumb}>{bg.src && <img src={bg.src} alt="" />}</span>
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>{bg.src ? '変更' : '選ぶ'}</Button>
                {bg.src && <Button variant="ghost" onClick={() => setDraft((d) => ({ ...d, background: { ...DEFAULT_BACKGROUND } }))}>削除</Button>}
              </div>
              {fileError && <ErrorText>{fileError}</ErrorText>}
              <div className={`${styles.position} ${placement ? '' : styles.disabled}`}>
                {(['x', 'y'] as const).map((axis) => {
                  const movable = !!placement && (axis === 'x' ? placement.overflowX > 0 : placement.overflowY > 0);
                  return (
                    <label key={axis} className={`${styles.numberField} ${movable ? '' : styles.disabled}`}>
                      <span>{axis.toUpperCase()}</span>
                      <input type="number" min={0} max={100} value={Math.round(bg[axis])} disabled={!movable} onChange={(e) => setBg({ [axis]: clamp(Number(e.target.value), 0, 100) })} />
                      <span>%</span>
                    </label>
                  );
                })}
              </div>
              <Slider label="彩度" value={bg.saturate} min={0} max={2} step={0.01} disabled={!bg.src} onChange={(v) => setBg({ saturate: v })} format={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="明るさ" value={bg.brightness} min={0.3} max={1.5} step={0.01} disabled={!bg.src} onChange={(v) => setBg({ brightness: v })} format={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="ぼかし" value={bg.blur} min={0} max={24} step={1} disabled={!bg.src} onChange={(v) => setBg({ blur: v })} format={(v) => `${v}px`} />
              <Slider label="オーバーレイ" value={bg.overlay} min={0} max={1} step={0.01} disabled={!bg.src} onChange={(v) => setBg({ overlay: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </>
          ) : (
            <div className={styles.themes} role="radiogroup" aria-label="テーマ">
              {THEMES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={draft.themeId === t.id} className={`${styles.themeCard} ${draft.themeId === t.id ? styles.themeActive : ''}`} onClick={() => setDraft((d) => ({ ...d, themeId: t.id }))}>
                  <Scaled width={preset.width} height={preset.height} scale={cardScale} className={styles.themeThumb}>
                    <SetlistImage {...imgProps} theme={t} />
                  </Scaled>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        </aside>
      </div>
    </div>,
    document.body,
  );
}
