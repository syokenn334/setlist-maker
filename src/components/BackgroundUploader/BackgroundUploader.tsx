import { useRef } from 'react';
import styles from './BackgroundUploader.module.css';

interface BackgroundUploaderProps {
  hasBackground: boolean;
  onUpload: (dataUrl: string) => void;
  onClear: () => void;
}

export function BackgroundUploader({ hasBackground, onUpload, onClear }: BackgroundUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpload(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={styles.uploader}>
      <div className={styles.label}>Background Image</div>
      <div className={styles.row}>
        <button className={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
          {hasBackground ? '画像を変更' : '画像を選択'}
        </button>
        {hasBackground && (
          <button className={styles.clearBtn} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hidden}
        onChange={handleChange}
      />
    </div>
  );
}
