import styles from './OverlayOpacitySlider.module.css';

interface OverlayOpacitySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function OverlayOpacitySlider({ value, onChange, disabled }: OverlayOpacitySliderProps) {
  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.label}>
        <span className={styles.value}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.2}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        disabled={disabled}
      />
    </div>
  );
}
