import styles from './RowsPerPageSlider.module.css';

interface RowsPerPageSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function RowsPerPageSlider({ value, onChange }: RowsPerPageSliderProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span className={styles.value}>{value}</span>
      </div>
      <input
        type="range"
        min={10}
        max={18}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
      />
    </div>
  );
}
