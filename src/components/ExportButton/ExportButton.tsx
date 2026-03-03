import { motion } from 'framer-motion';
import styles from './ExportButton.module.css';

interface ExportButtonProps {
  disabled: boolean;
  exporting: boolean;
  onClick: () => void;
}

export function ExportButton({ disabled, exporting, onClick }: ExportButtonProps) {
  const isDisabled = disabled || exporting;

  return (
    <motion.button
      className={styles.button}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
    >
      {exporting ? 'Exporting...' : 'PNG ダウンロード'}
    </motion.button>
  );
}
