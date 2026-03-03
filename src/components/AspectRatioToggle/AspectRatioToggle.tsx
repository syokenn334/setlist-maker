import type { AspectRatio } from '@core/layout.ts';
import styles from '../ColumnCountToggle/ColumnCountToggle.module.css';

interface AspectRatioToggleProps {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
  disabled?: boolean;
}

export function AspectRatioToggle({ value, onChange, disabled = false }: AspectRatioToggleProps) {
  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.toggle}>
        <button
          className={`${styles.btn} ${value === '16:9' ? styles.active : ''}`}
          onClick={() => onChange('16:9')}
          disabled={disabled}
        >
          16:9
        </button>
        <button
          className={`${styles.btn} ${value === '9:16' ? styles.active : ''}`}
          onClick={() => onChange('9:16')}
          disabled={disabled}
        >
          9:16
        </button>
      </div>
    </div>
  );
}
