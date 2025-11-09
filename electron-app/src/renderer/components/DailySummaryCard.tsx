import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, AlertTriangle, ClipboardList, Clock } from 'lucide-react';
import { fetchDailyTaskSummary, DailyTaskSummary } from 'src/api/dailySummaryApi';

export function DailySummaryCard() {
  const [summary, setSummary] = useState<DailyTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await fetchDailyTaskSummary();
        if (!mounted) return;
        setSummary(s);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load daily summary:', e);
        setError(e?.message ?? 'Failed to load daily summary');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="px-8 py-6 rounded-2xl border border-white/10 text-white/60"
        style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 200 }}
      >
        Loading summary…
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="px-8 py-6 rounded-2xl border border-white/10 text-red-300/80"
        style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 200 }}
      >
        {error}
      </motion.div>
    );
  }

  if (!summary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="px-8 py-6 rounded-2xl border border-white/10 text-white/60"
        style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 200 }}
      >
        No summary for today yet
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      className="px-8 py-6 rounded-2xl backdrop-blur-xl border border-white/10"
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex items-center gap-6 text-white/70 mb-5"
        style={{ fontWeight: 200 }}
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} /><span>{summary.stats.meetings} meetings</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} /><span>{summary.stats.urgent} urgent</span>
        </div>
        <div className="flex items-center gap-2">
          <ClipboardList size={16} /><span>{summary.stats.followUps} follow-ups</span>
        </div>
      </motion.div>

      {/* Next meeting */}
      {summary.nextMeeting && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-5"
        >
          <div className="flex items-center gap-2 text-white/70 mb-3 mt-6" style={{ fontWeight: 200 }}>
            <Clock size={16} /><span>Next</span>
          </div>
          <div className="pl-6 flex flex-col gap-1 text-white/90" style={{ fontWeight: 200 }}>
            <span className="opacity-60 text-sm">{formatTime(summary.nextMeeting.time)}</span>
            <span>{summary.nextMeeting.title}</span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Urgent */}
        {summary.urgent.length > 0 && (
          <div>
            <div className="text-white/70 mb-3 mt-6" style={{ fontWeight: 200 }}>Urgent</div>
            <ul className="pl-6 flex flex-col gap-1">
              {summary.urgent.map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                  className="text-white/90 text-sm"
                  style={{ fontWeight: 200 }}
                >
                  • {t.task}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow ups */}
        {summary.followUps.length > 0 && (
          <div>
            <div className="text-white/70 mb-3 mt-6" style={{ fontWeight: 200 }}>Follow-ups</div>
            <ul className="pl-6 flex flex-col gap-1">
              {summary.followUps.map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                  className="text-white/90 text-sm"
                  style={{ fontWeight: 200 }}
                >
                  • {t.task}
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
