import { useState, useRef, useCallback } from 'react';
import type { DragEvent } from 'react';
import styles from './DropZone.module.css';

interface DropZoneProps {
  onFile: (file: File) => void;
  currentFileName: string | null;
}

export function DropZone({ onFile, currentFileName }: DropZoneProps) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(true);
  }, []);

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) onFile(file);
  }, [onFile]);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  return (
    <div
      className={`${styles.dropZone} ${active ? styles.active : ''}`}
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className={styles.label}>
        rekordbox txt をドロップ
      </div>
      <div className={styles.hint}>またはクリックでファイル選択</div>
      {currentFileName && (
        <div className={styles.fileName}>{currentFileName}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        className={styles.hidden}
        onChange={handleChange}
      />
    </div>
  );
}
