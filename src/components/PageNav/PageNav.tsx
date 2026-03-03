import styles from './PageNav.module.css';

interface PageNavProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function PageNav({ currentPage, pageCount, onPageChange }: PageNavProps) {
  if (pageCount <= 1) return null;

  return (
    <div className={styles.nav}>
      <button
        className={styles.btn}
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ‹ 前へ
      </button>
      <span className={styles.indicator}>
        {currentPage + 1} / {pageCount}
      </span>
      <button
        className={styles.btn}
        disabled={currentPage === pageCount - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        次へ ›
      </button>
    </div>
  );
}
