import type { AspectRatio } from '@core/layout.ts';
import styles from '../ColumnCountToggle/ColumnCountToggle.module.css';

interface AspectRatioToggleProps {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
}

export function AspectRatioToggle({ value, onChange }: AspectRatioToggleProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>アスペクト比</div>
      <div className={styles.toggle}>
        <button
          className={`${styles.btn} ${value === '16:9' ? styles.active : ''}`}
          onClick={() => onChange('16:9')}
        >
          16:9
        </button>
        <button
          className={`${styles.btn} ${value === '9:16' ? styles.active : ''}`}
          onClick={() => onChange('9:16')}
        >
          9:16
        </button>
      </div>
    </div>
  );
}
