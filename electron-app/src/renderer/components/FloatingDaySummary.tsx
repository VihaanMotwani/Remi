import React, { useEffect, useRef, useState, useMemo } from 'react';
import styles from './FloatingDaySummary.module.css';

interface EventType {
  id: string;
  title: string;
  start: string | Date;
  end: string | Date;
  priority: 'urgent' | 'high' | 'low';
  type: 'event' | 'task';
  completed?: boolean;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function FloatingDaySummary() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  // Load events from localStorage
  const events: EventType[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('tempo_events');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      return parsed.map(p => ({ ...p, start: new Date(p.start), end: new Date(p.end) }));
    } catch (err) {
      return [];
    }
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const completedToday = events.filter(ev => ev.type === 'task' && ev.completed && isSameDay(new Date(ev.end), new Date()));
  const carryovers = events.filter(ev => ev.type === 'task' && !ev.completed);

  // notes per-day
  const notesKey = useMemo(() => {
    const d = new Date();
    return `tempo_eod_notes_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notesKey);
      if (raw) setNotes(raw);
    } catch (err) {}
  }, [notesKey]);

  const saveNotes = () => {
    try {
      localStorage.setItem(notesKey, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    } catch (err) {}
  };

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (!panelRef.current) return;
      const target = e.target as Node | null;
      if (target && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={styles.container}>
      <div className={`${styles.panel} ${open ? '' : styles.panelHidden}`} ref={panelRef} role="dialog" aria-label="End of day summary panel" aria-hidden={!open}>
          <div className={styles.headerRow}>
            <div className={styles.title}>End of Day Summary</div>
            <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close summary">✕</button>
          </div>

          <div className={styles.content}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Accomplished</div>
              {completedToday.length === 0 ? (
                <div className={styles.empty}>No completed tasks yet</div>
              ) : (
                <ul className={styles.list}>
                  {completedToday.map(t => <li key={t.id}>{t.title}</li>)}
                </ul>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Carry over</div>
              {carryovers.length === 0 ? (
                <div className={styles.empty}>Nothing to carry</div>
              ) : (
                <ul className={styles.list}>
                  {carryovers.map(t => <li key={t.id}>{t.title}</li>)}
                </ul>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Notes</div>
              <textarea
                className={styles.textarea}
                placeholder="Notes for today..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className={styles.row}>
                <button className={styles.saveBtn} onClick={saveNotes}>Save</button>
                {saved && <span className={styles.saved}>Saved</span>}
              </div>
            </div>
          </div>
        </div>

      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close end of day summary' : 'Open end of day summary'}
      >
        {open ? 'Close Summary' : 'End of Day Summary'}
      </button>
    </div>
  );
}
