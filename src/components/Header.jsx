import styles from './Header.module.css';

export default function Header({ onToggleInfo, showInfo }) {
  return (
    <header className={styles.header}>
      {/* Left: branding */}
      <div className={styles.left}>
        <button
          className={`${styles.infoBtn} ${showInfo ? styles.infoBtnActive : ''}`}
          onClick={onToggleInfo}
          title={showInfo ? 'Cerrar informe' : 'Abrir informe técnico'}
        >
          <span className={styles.infoBtnIcon}>≡</span>
        </button>
        <div className={styles.brand}>
          <h1 className={styles.title}>
            <span className={styles.titleAccent}>PEMEX</span>
            &nbsp;Derrame 2026
          </h1>
          <p className={styles.subtitle}>Monitoreo Forense — Golfo de México</p>
        </div>
      </div>
    </header>
  );
}
