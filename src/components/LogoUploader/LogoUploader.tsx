import { useRef } from 'react';
import styles from './LogoUploader.module.css';

interface LogoUploaderProps {
  hasLogo: boolean;
  onUpload: (dataUrl: string, naturalWidth: number, naturalHeight: number) => void;
  onClear: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

export function LogoUploader({ hasLogo, onUpload, onClear }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_FILE_SIZE) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        // SVG without intrinsic size may report 0; fallback to 1:1
        const w = img.naturalWidth || 100;
        const h = img.naturalHeight || 100;
        onUpload(dataUrl, w, h);
      };
      img.onerror = () => onUpload(dataUrl, 100, 100);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={styles.uploader}>
      <div className={styles.row}>
        <button className={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
          {hasLogo ? 'ロゴを変更' : 'ロゴを選択'}
        </button>
        {hasLogo && (
          <button className={styles.clearBtn} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className={styles.hidden}
        onChange={handleChange}
      />
    </div>
  );
}
