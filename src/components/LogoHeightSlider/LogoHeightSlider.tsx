import styles from './LogoHeightSlider.module.css';

interface LogoHeightSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function LogoHeightSlider({ value, onChange, disabled }: LogoHeightSliderProps) {
  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.label}>
        <span>ロゴ高さ</span>
        <span className={styles.value}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.2}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        disabled={disabled}
      />
    </div>
  );
}
