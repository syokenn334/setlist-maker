import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number;
  total: number;
}

export function ProgressBar({ progress, total }: ProgressBarProps) {
  const pct = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span>Artwork取得中...</span>
        <span>{progress} / {total}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
