import { useRef, useEffect, useState, useCallback } from 'react';
import { EVENTS, SEVERITY_COLOR } from '../data/events.js';
import styles from './ChronologyPanel.module.css';

const FMT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
const formatDate = iso => FMT.format(new Date(iso + 'T12:00:00Z'));

const TIMELINE_EVENTS = EVENTS.filter(e => e.id !== 'baseline');

export default function ChronologyPanel({ currentDate, onEventSelect }) {
  const [open, setOpen] = useState(false);
  const activeRef = useRef(null);
  const listRef   = useRef(null);
  const [hasMore, setHasMore] = useState(false);

  // Auto-scroll active card into view when open
  useEffect(() => {
    if (!open) return;
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentDate, open]);

  // Detect whether there is content below the visible area
  const checkScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, [open, checkScroll]);

  const currentId    = [...TIMELINE_EVENTS].filter(e => e.date <= currentDate).pop()?.id ?? null;
  const passedCount  = TIMELINE_EVENTS.filter(e => e.date <= currentDate).length;
  const remainingBelow = hasMore
    ? TIMELINE_EVENTS.length - TIMELINE_EVENTS.findIndex(e => {
        const el = listRef.current;
        return el && e.date > currentDate;
      })
    : 0;

  return (
    <aside className={styles.panel}>
      {/* Toggle header */}
      <button className={styles.toggle} onClick={() => setOpen(v => !v)}>
        <span className={styles.toggleLeft}>
          <span className={styles.toggleIcon}>📅</span>
          <span className={styles.toggleLabel}>Cronología</span>
        </span>
        <span className={styles.toggleRight}>
          <span className={styles.badge}>{passedCount}&thinsp;/&thinsp;{TIMELINE_EVENTS.length}</span>
          <span className={styles.caret}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className={styles.listWrap}>
          <div className={styles.list} ref={listRef} onScroll={checkScroll}>
            {TIMELINE_EVENTS.map(evt => {
              const passed  = evt.date <= currentDate;
              const current = evt.id === currentId;

              return (
                <button
                  key={evt.id}
                  ref={current ? activeRef : null}
                  className={[
                    styles.card,
                    passed  ? styles.cardPassed  : '',
                    current ? styles.cardCurrent : '',
                  ].join(' ')}
                  onClick={() => onEventSelect(evt)}
                  title={`Ir al ${formatDate(evt.date)}`}
                >
                  <span
                    className={styles.bar}
                    style={{ background: SEVERITY_COLOR[evt.severity] ?? '#64748b' }}
                  />
                  <span className={styles.cardBody}>
                    <span className={styles.cardDate}>{formatDate(evt.date)}</span>
                    <span className={styles.cardTitle}>{evt.title}</span>
                    {evt.subtitle && (
                      <span className={styles.cardSub}>{evt.subtitle}</span>
                    )}
                  </span>
                  {current && <span className={styles.nowBadge}>▶ Ahora</span>}
                </button>
              );
            })}
          </div>

          {/* Coverage end label */}
          <div className={styles.coverageLabel}>
            Eventos documentados hasta el 31 mar 2026
          </div>

          {/* Gradient + hint when content is below the fold */}
          {hasMore && (
            <div className={styles.moreHint}>
              <span className={styles.moreArrow}>▼</span>
              <span>más eventos</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
