import styles from './ColumnCountToggle.module.css';

interface ColumnCountToggleProps {
  value: 1 | 2;
  onChange: (value: 1 | 2) => void;
}

export function ColumnCountToggle({ value, onChange }: ColumnCountToggleProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>列数</div>
      <div className={styles.toggle}>
        <button
          className={`${styles.btn} ${value === 1 ? styles.active : ''}`}
          onClick={() => onChange(1)}
        >
          1列
        </button>
        <button
          className={`${styles.btn} ${value === 2 ? styles.active : ''}`}
          onClick={() => onChange(2)}
        >
          2列
        </button>
      </div>
    </div>
  );
}
