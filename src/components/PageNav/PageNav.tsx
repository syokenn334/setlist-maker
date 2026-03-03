import { motion } from 'framer-motion';
import styles from './PageNav.module.css';

interface PageNavProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function PageNav({ currentPage, pageCount, onPageChange }: PageNavProps) {
  const hidden = pageCount <= 1;

  return (
    <motion.div
      className={styles.nav}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: hidden ? 'none' : 'auto' }}
    >
      <button
        className={styles.btn}
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        &lsaquo; 前へ
      </button>
      <span className={styles.indicator}>
        {currentPage + 1} / {pageCount}
      </span>
      <button
        className={styles.btn}
        disabled={currentPage === pageCount - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        次へ &rsaquo;
      </button>
    </motion.div>
  );
}
