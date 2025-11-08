import React, { useState, useEffect } from 'react';
import { Meeting } from 'src/types';
import { fetchTodaysEvents } from '../../api/meetingApi'; // adjust relative path correctly
import { motion, AnimatePresence } from 'framer-motion';
import styles from './MeetingComponent.module.css';

const Meetings: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const data = await fetchTodaysEvents();
        setMeetings(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const now = new Date();

  const upcoming = meetings
    .filter(m => m.startTime.getTime() + m.durationMinutes * 60000 > now.getTime())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const past = meetings
    .filter(m => m.startTime.getTime() + m.durationMinutes * 60000 <= now.getTime())
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  const selectedMeeting = meetings.find(m => m.id === selectedId) ?? null;

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className={styles.meetingsContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading meetings...</p>
      </div>
    );
  }

  return (
    <div className={styles.meetingsContainer}>
      <aside className={styles.sidebar}>
        <section>
          <h3 className={styles.sectionTitle}>Upcoming Meetings</h3>
          <div className={styles.meetingList}>
            {upcoming.map(meeting => (
              <button
                key={meeting.id}
                className={`${styles.meetingItem} ${selectedId === meeting.id ? styles.selected : ''}`}
                onClick={() => setSelectedId(meeting.id)}
                aria-current={selectedId === meeting.id ? 'true' : undefined}
              >
                <div className={styles.timeCol}>
                  <div>{formatTime(meeting.startTime)}</div>
                  <div className={styles.duration}>{meeting.durationMinutes} min</div>
                </div>
                <div className={styles.detailsCol}>
                  <div className={styles.title}>{meeting.title}</div>
                  <div className={styles.attendees} title={meeting.attendees.join(', ')}>
                    {meeting.attendees.join(', ')}
                  </div>
                  <div className={styles.agenda}>{meeting.agenda}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className={`${styles.sectionTitle} ${styles.pastTitle}`}>Past Meetings</h3>
          <div className={`${styles.meetingList} ${styles.pastList}`}>
            {past.map(meeting => (
              <button
                key={meeting.id}
                className={`${styles.meetingItem} ${styles.past} ${selectedId === meeting.id ? styles.pastSelected : ''}`}
                onClick={() => setSelectedId(meeting.id)}
                aria-current={selectedId === meeting.id ? 'true' : undefined}
              >
                <div className={styles.timeCol}>
                  <div>{formatTime(meeting.startTime)}</div>
                  <div className={styles.duration}>{meeting.durationMinutes} min</div>
                </div>
                <div className={styles.detailsCol}>
                  <div className={styles.title}>{meeting.title}</div>
                  <div className={styles.attendees} title={meeting.attendees.join(', ')}>
                    {meeting.attendees.join(', ')}
                  </div>
                  <div className={styles.agenda}>{meeting.agenda}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className={styles.detailsPanel} aria-live="polite">
        <AnimatePresence mode="wait">
          {selectedMeeting ? (
            <motion.div
              key={selectedMeeting.id}
              className={styles.detailsContent}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className={styles.detailsTitle}>{selectedMeeting.title}</h2>
              <div className={styles.detailsColumns}>
                <section className={styles.detailsColumnsSection}>
                  <h4>Preparation Notes</h4>
                  <p>{selectedMeeting.preparationNotes || 'No notes.'}</p>
                </section>
                <section className={styles.detailsColumnsSection}>
                  <h4>Meeting Notes</h4>
                  <p>{selectedMeeting.meetingNotes || 'No notes yet.'}</p>
                </section>
                <section className={styles.detailsColumnsSection}>
                  <h4>Action Items</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedMeeting.actionItems || 'No action items.'}</pre>
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className={styles.detailsPlaceholder}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p>Select a meeting to see details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Meetings;
