import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Mail, Clock } from 'lucide-react';
import { fetchTodaysMeetings } from 'src/api/meetingApi';
import { fetchUnrespondedEmails } from 'src/api/messagesClient';
import type { Meeting } from 'src/types';

// Minimal email shape for UI
type EmailItem = {
  id: string;
  subject: string;
  from: string;
  timestamp?: string;
  actionCount?: number;
};

export function DayPlan() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [mtgs, emailsRaw] = await Promise.all([
          fetchTodaysMeetings(),
          fetchUnrespondedEmails(),
        ]);

        const emailItems: EmailItem[] = (emailsRaw || []).map((e: any) => ({
          id: e.id ?? e.thread_id ?? crypto.randomUUID(),
          subject: e.subject || '(no subject)',
          from: e.from_email || 'Unknown',
          timestamp: e.timestamp,
          actionCount: Array.isArray(e.action_items) ? e.action_items.length : 0,
        }));

        if (!mounted) return;
        setMeetings(mtgs || []);
        setEmails(emailItems);
      } catch (e: any) {
        console.error('Failed to load day plan:', e);
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const hasAny = (meetings?.length ?? 0) + (emails?.length ?? 0) > 0;

  const nextMeeting = useMemo(() => {
    const now = Date.now();
    return [...meetings]
      .filter(m => m.startTime.getTime() >= now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
  }, [meetings]);

  if (loading) {
    return (
      <div className="text-white/50 tracking-wide text-center py-4" style={{ fontWeight: 200 }}>
        Loading your day…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400/80 tracking-wide text-center py-4" style={{ fontWeight: 200 }}>
        {error}
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="text-white/50 tracking-wide text-center py-4" style={{ fontWeight: 200 }}>
        You're all caught up for today
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      className="relative w-full"
    >
      {/* Next up (non-scrollable) */}
      {nextMeeting && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="px-5 py-3 mb-4 rounded-2xl backdrop-blur-xl border border-white/10"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-3 mb-2 text-white/70" style={{ fontWeight: 200 }}>
            <Clock size={16} />
            <span>Next up</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-white/60 tracking-wider" style={{ fontWeight: 200 }}>
                {nextMeeting.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-white/90 tracking-wide" style={{ fontWeight: 200 }}>{nextMeeting.title}</span>
                {nextMeeting.agenda && (
                  <span className="text-white/50 tracking-wide" style={{ fontWeight: 200, fontSize: '0.85rem' }}>
                    {truncate(nextMeeting.agenda, 80)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Day Plan scroll area (single scroll container) */}
      <div
        className="overflow-y-auto max-h-[60vh] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{
            scrollbarGutter: 'stable',
            WebkitOverflowScrolling: 'touch',
        }}
        >

        {/* Meetings section */}
        {meetings.length > 0 && (
          <Section title="Today's meetings" icon={Calendar}>
            <div className="space-y-2">
              {meetings.map((m, idx) => (
                <Row
                  key={m.id}
                  index={idx}
                  left={
                    <span className="text-white/50 tracking-wider" style={{ fontWeight: 200 }}>
                      {m.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  }
                  right={
                    <div className="flex flex-col">
                      <span className="text-white/90 tracking-wide" style={{ fontWeight: 200 }}>{m.title}</span>
                      {m.preparationNotes && (
                        <span className="text-white/50 tracking-wide" style={{ fontWeight: 200, fontSize: '0.85rem' }}>
                          {truncate(m.preparationNotes, 100)}
                        </span>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          </Section>
        )}

        {/* Emails section */}
        {emails.length > 0 && (
          <Section title="Emails to respond" icon={Mail}>
            <div className="space-y-2">
              {emails.slice(0, 5).map((e, idx) => (
                <Row
                  key={e.id}
                  index={idx}
                  left={
                    <span className="text-white/50 tracking-wider" style={{ fontWeight: 200 }}>
                      {formatTime(e.timestamp)}
                    </span>
                  }
                  right={
                    <div className="flex flex-col">
                      <span className="text-white/90 tracking-wide" style={{ fontWeight: 200 }}>
                        {e.subject}
                      </span>
                      <span className="text-white/50 tracking-wide" style={{ fontWeight: 200, fontSize: '0.85rem' }}>
                        From {e.from}{typeof e.actionCount === 'number' && e.actionCount > 0 ? ` · ${e.actionCount} action item${e.actionCount > 1 ? 's' : ''}` : ''}
                      </span>
                    </div>
                  }
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-3 text-white/70" style={{ fontWeight: 200 }}>
        <Icon size={16} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ left, right, index }: { left: React.ReactNode; right: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.25, 1, 0.5, 1] }}
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
      className="px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/10"
      style={{ background: 'rgba(255, 255, 255, 0.03)', transition: 'background-color 0.3s ease' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {left}
          <div className="h-8 w-px bg-white/10" />
          {right}
        </div>
      </div>
    </motion.div>
  );
}

function truncate(s: string, n: number) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
