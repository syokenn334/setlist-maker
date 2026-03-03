import type { ReactNode } from 'react';
import type { SetlistTemplate } from '../templates/index.ts';
import styles from './Canvas.module.css';

interface CanvasProps {
  template: SetlistTemplate;
  backgroundImage: string | null;
  overlayOpacity: number;
  width: number;
  height: number;
  children: ReactNode;
}

function templateToVars(t: SetlistTemplate): React.CSSProperties {
  return {
    '--sl-canvas-bg': t.canvasBackground,
    '--sl-header-border': t.headerBorderColor,
    '--sl-event': t.eventColor,
    '--sl-date': t.dateColor,
    '--sl-dj': t.djColor,
    '--sl-total': t.totalColor,
    '--sl-row-odd': t.rowOddBackground,
    '--sl-row-even': t.rowEvenBackground,
    '--sl-num': t.numColor,
    '--sl-title': t.titleColor,
    '--sl-sub': t.subColor,
    '--sl-bpm': t.bpmColor,
    '--sl-time': t.timeColor,
    '--sl-genre-bg': t.genreBgColor,
    '--sl-genre-text': t.genreTextColor,
    '--sl-no-art': t.noArtBackground,
    '--sl-brand': t.brandColor,
    '--sl-overlay': t.overlayColor,
  } as React.CSSProperties;
}

export function Canvas({ template, backgroundImage, overlayOpacity, width, height, children }: CanvasProps) {
  return (
    <div className={styles.canvas} style={{ ...templateToVars(template), width, height }}>
      {backgroundImage && (
        <>
          <div
            className={styles.backgroundImage}
            style={{ backgroundImage: `url("${backgroundImage}")` }}
          />
          <div className={styles.overlay} style={{ opacity: overlayOpacity }} />
        </>
      )}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
