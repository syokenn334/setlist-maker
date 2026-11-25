/**
 * 生成画像 1 ページ分 (Figma のセクション 6 / コンポーネント Image / ...)
 *
 * 寸法はすべて core/imageLayout.ts で計算した論理ピクセル。書き出しは modern-screenshot が
 * この DOM をそのまま描画するので、CSS の filter / object-fit / ellipsis がそのまま使える。
 */
import type { CSSProperties, MouseEvent } from 'react';
import type { TrackWithArtwork, SetlistMetadata } from '../types/index.ts';
import type { CanvasPreset } from '../core/presets.ts';
import type { ImageTheme } from '../themes/index.ts';
import type { PageSlice } from '../core/pagination.ts';
import type { BackgroundSettings } from '../core/background.ts';
import { placeBackground } from '../core/background.ts';
import { computeGeometry, TYPE, LINE_HEIGHT, COLUMN_GUTTER } from '../core/imageLayout.ts';

/** 枠を中身の左右に張り出す幅 (レイアウトの余白 24px の半分) */
const ROW_FRAME_OUTSET = 12;
import styles from './SetlistImage.module.css';

export interface SetlistImageProps {
  preset: CanvasPreset;
  columns: 1 | 2;
  /** 1 列の曲数 (null は 10) */
  rowsLimit: number | null;
  /** 行ごとの枠 (曲名の枠) */
  rowFrame: boolean;
  /** ジャケットの列を出す。false のときは列ごとなくし、曲名を左に詰める */
  showArtwork: boolean;
  theme: ImageTheme;
  metadata: SetlistMetadata;
  /** 全曲 (ページの曲は slice で切り出す) */
  tracks: TrackWithArtwork[];
  slice: PageSlice;
  pageIndex: number;
  pageCount: number;
  hidden: ReadonlySet<number>;
  background: BackgroundSettings;
  qrDataUrl: string | null;
  /** プレビューでだけ代用ジャケットに印を付ける (書き出しには出さない) */
  substitutes?: ReadonlySet<number>;
  onTrackClick?: (globalIndex: number, event: MouseEvent<HTMLDivElement>) => void;
}

export function SetlistImage(props: SetlistImageProps) {
  const { preset, columns, rowsLimit, rowFrame, showArtwork, theme, metadata, tracks, slice, pageIndex, pageCount, hidden, background, qrDataUrl, substitutes, onTrackClick } = props;
  const g = computeGeometry(preset, columns, rowsLimit);
  const maxNo = tracks.reduce((m, t, i) => Math.max(m, t.number ?? i + 1), 0);
  const numberDigits = Math.max(2, String(maxNo).length);
  // 再生時間の列幅: 全曲で最も長い表記 (例 4:13 / 1:02:03) の数字の数 x 1ch (等幅数字) + コロンの幅
  const longestTime = tracks.reduce((m, t) => ((t.time?.length ?? 0) > m.length ? t.time! : m), '0:00');
  const timeWidth = `calc(${longestTime.replace(/\D/g, '').length}ch + ${(longestTime.match(/:/g) ?? []).length * 0.3}em)`;
  const bg = placeBackground(background, g.width, g.height);
  const blurPad = background.blur * 3;

  const vars = {
    '--img-bg': theme.bg,
    '--img-surface': theme.surface,
    '--img-text-primary': theme.textPrimary,
    '--img-text-secondary': theme.textSecondary,
    '--img-accent': theme.accent,
    width: g.width,
    height: g.height,
  } as CSSProperties;

  const columnsOnPage = slice.columnCounts;
  const columnStarts = columnsOnPage.map((_, c) => slice.start + columnsOnPage.slice(0, c).reduce((a, b) => a + b, 0));

  return (
    <div className={styles.image} style={vars}>
      {bg && (
        <div className={styles.background}>
          <img
            src={background.src!}
            alt=""
            style={{
              left: bg.left - blurPad, top: bg.top - blurPad,
              width: bg.width + blurPad * 2, height: bg.height + blurPad * 2,
              filter: `saturate(${background.saturate}) brightness(${background.brightness}) blur(${background.blur}px)`,
            }}
          />
          <div className={styles.overlay} style={{ opacity: background.overlay }} />
        </div>
      )}

      {/* Header */}
      <div className={`${styles.text} ${styles.event}`} style={{ left: g.marginX, top: g.eventY, width: g.width - g.marginX * 2, fontSize: TYPE.event }}>
        {metadata.eventName}
      </div>
      <div className={styles.subRow} style={{ left: g.marginX, top: g.subY, width: g.width - g.marginX * 2, fontSize: TYPE.headSub }}>
        <span className={styles.subLeft}>{[metadata.date, metadata.djName].filter(Boolean).join(' ・ ')}</span>
        <span className={styles.subRight}>{`${tracks.length} 曲 ・ ${pageIndex + 1} / ${pageCount}`}</span>
      </div>
      <div className={styles.divider} style={{ left: g.safeX, top: g.dividerY, width: g.width - g.safeX * 2 }} />

      {/* Rows */}
      {columnsOnPage.map((count, c) => {
        const x = g.marginX + c * (g.columnWidth + COLUMN_GUTTER);
        const rows = [];
        for (let i = 0; i < count; i++) {
          const index = columnStarts[c] + i;
          const track = tracks[index];
          if (!track) break;
          const y = g.listTop + i * g.pitch;
          const isHidden = hidden.has(index);
          const isSub = substitutes?.has(index) ?? false;
          rows.push(
            <div
              key={index}
              className={`${styles.row} ${rowFrame ? styles.framed : ''} ${onTrackClick ? styles.clickable : ''}`}
              style={{ left: x - ROW_FRAME_OUTSET, top: y, width: g.columnWidth + ROW_FRAME_OUTSET * 2, height: g.band, paddingInline: ROW_FRAME_OUTSET }}
              onClick={onTrackClick ? (e) => onTrackClick(index, e) : undefined}
            >
              {/* Centred in its column; frame inset + 0.5ch on the left, row gap + 0.5ch (4px more) on the right */}
              <span className={styles.number} style={{ width: `${numberDigits}ch`, marginInline: '0.5ch', fontSize: g.subSize }}>{track.number ?? index + 1}</span>
              {showArtwork && (
                <span className={`${styles.artwork} ${isSub && !isHidden ? styles.substitute : ''}`} style={{ width: g.artwork, height: g.artwork }}>
                  {!isHidden && track.artworkUrl && <img src={track.artworkUrl} alt="" crossOrigin="anonymous" />}
                </span>
              )}
              {isHidden ? (
                <>
                  <span className={styles.info}>
                    <span className={styles.redacted} style={{ width: '60%', height: g.titleSize * 0.6 }} />
                    <span className={styles.redacted} style={{ width: '40%', height: g.subSize * 0.5 }} />
                  </span>
                  <span className={styles.redacted} style={{ width: '3ch', height: g.subSize * 0.6, fontSize: g.subSize }} />
                  <span className={`${styles.redacted} ${styles.timeGap}`} style={{ width: timeWidth, height: g.subSize * 0.6, fontSize: g.subSize }} />
                </>
              ) : (
                <>
                  <span className={styles.info} style={{ height: g.textBlock }}>
                    <span className={`${styles.text} ${styles.title}`} style={{ fontSize: g.titleSize, lineHeight: LINE_HEIGHT, height: g.titleSize * LINE_HEIGHT }}>{track.title ?? 'Unknown'}</span>
                    <span className={`${styles.text} ${styles.artist}`} style={{ fontSize: g.subSize, lineHeight: LINE_HEIGHT, height: g.subSize * LINE_HEIGHT }}>{track.artist ?? ''}</span>
                  </span>
                  <span className={styles.bpm} style={{ fontSize: g.subSize }}>{track.bpm ? Math.round(track.bpm) : '–'}</span>
                  <span className={`${styles.time} ${styles.timeGap}`} style={{ width: timeWidth, fontSize: g.subSize }}>{track.time || '–'}</span>
                </>
              )}
            </div>,
          );
        }
        return rows;
      })}

      {slice.hasQr && qrDataUrl && (
        <img
          className={styles.qr}
          src={qrDataUrl}
          alt=""
          style={{ left: g.width - g.marginX - g.qrSize, top: g.listTop + g.listHeight - g.qrSize, width: g.qrSize, height: g.qrSize }}
        />
      )}

      <div className={`${styles.text} ${styles.credit}`} style={{ left: g.marginX, top: g.creditY, width: g.width - g.marginX * 2, fontSize: TYPE.credit }}>
        setlist-maker
      </div>

    </div>
  );
}
