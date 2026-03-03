import { motion } from 'framer-motion';
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
        <motion.div
          className={styles.bar}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
