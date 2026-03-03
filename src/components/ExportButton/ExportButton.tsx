import styles from './ExportButton.module.css';

interface ExportButtonProps {
  disabled: boolean;
  exporting: boolean;
  onClick: () => void;
}

export function ExportButton({ disabled, exporting, onClick }: ExportButtonProps) {
  return (
    <button
      className={styles.button}
      disabled={disabled || exporting}
      onClick={onClick}
    >
      {exporting ? 'Exporting...' : 'PNG ダウンロード'}
    </button>
  );
}
