import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { LiquidBlob } from './LiquidBlob';
// import { fetchTodaysMeetings } from 'src/api/meetingApi';
import { fetchAllMeetings } from 'src/api/meetingsAllApi';
import type { Meeting } from 'src/types';

interface MeetingsViewProps {
  onBack: () => void;
}

export function MeetingsView({ onBack }: MeetingsViewProps) {
  // Selection and layout
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blobPosition, setBlobPosition] = useState<'center' | 'left'>('center');

  // Data + status
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
  // Pull all meetings from events table (non-tasks)
  const data = await fetchAllMeetings();
        if (mounted) {
          setMeetings(data);
          // Select the first UPCOMING meeting by local time; fallback to earliest by startTime
          const nowLocal = new Date();
          const upcomingFromData = data
            .filter(m => {
              const localStart = new Date(m.startTime as unknown as Date);
              const localEnd = new Date(localStart.getTime() + m.durationMinutes * 60000);
              return localEnd > nowLocal;
            })
            .sort((a, b) => new Date(a.startTime as unknown as Date).getTime() - new Date(b.startTime as unknown as Date).getTime());

          if (upcomingFromData.length > 0) {
            setSelectedId(upcomingFromData[0].id);
          } else if (data.length > 0) {
            const earliest = [...data].sort((a, b) => new Date(a.startTime as unknown as Date).getTime() - new Date(b.startTime as unknown as Date).getTime())[0];
            setSelectedId(earliest.id);
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load meetings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Local time helpers and ordering
  const now = new Date();
  const upcoming = meetings
    .filter(m => {
      const localStart = new Date(m.startTime);
      const localEnd = new Date(localStart.getTime() + m.durationMinutes * 60000);
      return localEnd > now;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const past = meetings
    .filter(m => {
      const localStart = new Date(m.startTime);
      const localEnd = new Date(localStart.getTime() + m.durationMinutes * 60000);
      return localEnd <= now;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const orderedMeetings: Meeting[] = [...upcoming, ...past];

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const handleExpand = (id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
    setBlobPosition('left');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-full overflow-hidden"
    >
      {/* Solid black background */}
      <div className="absolute inset-0 bg-black" />

      {/* Blob - swims to the left when viewing meetings */}
      <motion.div
        className="absolute top-8 z-0"
        initial={{ left: '50%', x: '-50%', scale: 0.4, opacity: 0.3 }}
        animate={{
          left: blobPosition === 'left' ? '8%' : '50%',
          x: blobPosition === 'left' ? '0%' : '-50%',
          scale: 0.4,
          opacity: 0.3,
        }}
        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      >
        <LiquidBlob />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-8"
        >
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/70" strokeWidth={1.5} />
          </button>
          <h2 className="text-white tracking-[0.1em]" style={{ fontWeight: 200, fontSize: '2rem' }}>
            Today's Meetings
          </h2>
        </motion.div>

        {/* Meetings List */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          {loading && (
            <div className="text-white/50 tracking-wide" style={{ fontWeight: 200 }}>
              Loading meetings…
            </div>
          )}
          {error && (
            <div className="text-red-400 tracking-wide" style={{ fontWeight: 200 }}>
              {error}
            </div>
          )}
          {!loading && !error &&
            orderedMeetings.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 1, 0.5, 1] }}
                className="backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden"
                style={{
                  background:
                    selectedId === meeting.id ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <button
                  onClick={() => handleExpand(meeting.id)}
                  className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-white/50 tracking-wider min-w-[80px]" style={{ fontWeight: 200, fontSize: '0.9rem' }}>
                      {meeting.startTime ? formatTime(meeting.startTime) : '--'}
                    </span>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-left">
                      <h3 className="text-white/90 tracking-wide mb-1" style={{ fontWeight: 200, fontSize: '1.1rem' }}>
                        {meeting.title}
                      </h3>
                      <p className="text-white/40 tracking-wide" style={{ fontWeight: 200, fontSize: '0.85rem' }}>
                        {Array.isArray(meeting.attendees) && meeting.attendees.length
                          ? meeting.attendees.join(' · ')
                          : 'No attendees'}
                      </p>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: selectedId === meeting.id ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                  </motion.div>
                </button>

                {/* Expanded Content */}
                <motion.div
                  initial={false}
                  animate={{ height: selectedId === meeting.id ? 'auto' : 0, opacity: selectedId === meeting.id ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-8 pb-6 space-y-4">
                    <div className="h-px bg-white/10 mb-4" />

                    <div>
                      <h4 className="text-white/60 tracking-wider mb-2" style={{ fontWeight: 200, fontSize: '0.8rem' }}>
                        PREP NOTES
                      </h4>
                      <p className="text-white/80 tracking-wide" style={{ fontWeight: 200, fontSize: '0.95rem', lineHeight: 1.7 }}>
                        {meeting.preparationNotes || meeting.agenda || '—'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-white/60 tracking-wider mb-2" style={{ fontWeight: 200, fontSize: '0.8rem' }}>
                        LAST MEETING SUMMARY
                      </h4>
                      <p className="text-white/80 tracking-wide" style={{ fontWeight: 200, fontSize: '0.95rem', lineHeight: 1.7 }}>
                        {meeting.meetingNotes || 'No previous notes'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-white/60 tracking-wider mb-2" style={{ fontWeight: 200, fontSize: '0.8rem' }}>
                        ACTION ITEMS
                      </h4>
                      <ul className="space-y-2">
                        {(typeof meeting.actionItems === 'string'
                          ? meeting.actionItems.split('\n')
                          : Array.isArray(meeting.actionItems)
                          ? (meeting.actionItems as unknown as string[])
                          : [])
                          .filter(Boolean)
                          .map((action: string, i: number) => (
                            <li key={i} className="text-white/80 tracking-wide flex items-start gap-2" style={{ fontWeight: 200, fontSize: '0.95rem', lineHeight: 1.7 }}>
                              <span className="text-blue-400 mt-1">•</span>
                              {action}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}
