import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { LiquidBlob } from './LiquidBlob';
import { fetchUnrespondedEmails, updateEmailResponse } from 'src/api/messagesClient';
import type { Email } from 'src/types';

interface CommunicationViewProps {
  onBack: () => void;
}

export function CommunicationView({ onBack }: CommunicationViewProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Draft of the reply (renamed from `response` to avoid name collision with fetch response object)
  const [responseDraft, setResponseDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchUnrespondedEmails();
        if (mounted) {
          setEmails(data as Email[]);
          if (data.length > 0) {
            setResponseDraft(data[0].response || '');
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load emails');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const currentEmail = emails[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
  setResponseDraft(emails[newIndex].response || '');
    }
  };

  const handleNext = () => {
    if (currentIndex < emails.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
  setResponseDraft(emails[newIndex].response || '');
    }
  };

  const handleSend = async () => {
    if (!currentEmail) return;
    if (!responseDraft.trim()) {
      setError('Response draft is empty');
      return;
    }

  // In the renderer, Node's process.env is not guaranteed; use Vite's import.meta.env.
  const API_BASE = 'https://remi-q7gs.onrender.com';
    setSending(true);
    setError(null);

    try {
      // POST to remote email reply endpoint
      const httpRes = await fetch(`${API_BASE}/send-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: currentEmail.thread_id,
            // Use original sender as "from" and recipient as "to" as per existing server.mjs contract
          to: (currentEmail as any).to_email || currentEmail.from_email, // fallback if shape differs
          from: currentEmail.from_email,
          body: responseDraft,
        }),
      });

      console.log('Sending reply payload:', {
        threadId: currentEmail.thread_id,
        to: (currentEmail as any).to_email || currentEmail.from_email,
        from: currentEmail.from_email,
        body: responseDraft,
      });

      // Handle non-2xx quickly
      if (!httpRes.ok) {
        const text = await httpRes.text();
        throw new Error(`HTTP ${httpRes.status}: ${text || httpRes.statusText}`);
      }

      const result = await httpRes.json().catch(() => ({ success: false, error: 'Invalid JSON response' }));

      if (result.success) {
        console.log('Reply sent successfully');
        // Persist updated response locally (if this marks email as handled)
        try {
          await updateEmailResponse(currentEmail.thread_id, responseDraft);
        } catch (persistErr) {
          console.warn('Failed to persist response update locally:', persistErr);
        }

        // Remove the handled email
        const updatedEmails = emails.filter((_, i) => i !== currentIndex);
        setEmails(updatedEmails);

        if (updatedEmails.length === 0) {
          setCurrentIndex(0);
          setResponseDraft('');
        } else {
          const newIndex = Math.min(currentIndex, updatedEmails.length - 1);
          setCurrentIndex(newIndex);
          setResponseDraft(updatedEmails[newIndex]?.response || '');
        }
      } else {
        throw new Error(result.error || 'Send failed');
      }
    } catch (e: any) {
      console.error('Failed to send response:', e);
      setError(e?.message || 'Failed to send response');
    } finally {
      setSending(false);
    }
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

      {/* Blob - floats in background */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
        style={{ scale: 0.3, opacity: 0.15 }}
      >
        <LiquidBlob />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between px-8 py-6"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" strokeWidth={1.5} />
            </button>
            <h2 
              className="text-white tracking-[0.1em]"
              style={{ fontWeight: 200, fontSize: '2rem' }}
            >
              Emails
            </h2>
          </div>
          <p 
            className="text-white/50 tracking-wider"
            style={{ fontWeight: 200, fontSize: '0.9rem' }}
          >
            {currentIndex + 1} / {emails.length}
          </p>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex items-center px-8 py-8">
          {loading && (
            <div className="flex-1 text-center text-white/50 tracking-wide" style={{ fontWeight: 200 }}>
              Loading emails…
            </div>
          )}
          
          {error && (
            <div className="flex-1 text-center text-red-400 tracking-wide" style={{ fontWeight: 200 }}>
              {error}
            </div>
          )}

          {!loading && !error && emails.length === 0 && (
            <div className="flex-1 text-center text-white/50 tracking-wide" style={{ fontWeight: 200 }}>
              No emails to triage
            </div>
          )}

          {!loading && !error && emails.length > 0 && (
            <>
              {/* Left Arrow */}
              <motion.button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                whileHover={{ scale: currentIndex === 0 ? 1 : 1.1 }}
                whileTap={{ scale: currentIndex === 0 ? 1 : 0.95 }}
                className="p-4 rounded-full border border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity mr-8"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <ChevronLeft className="w-6 h-6 text-white/70" strokeWidth={1.5} />
              </motion.button>

              {/* Email Card */}
              <motion.div
                key={currentEmail?.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="flex-1 max-w-4xl mx-auto"
              >
                <div 
                  className="px-12 py-10 backdrop-blur-xl border border-white/10 rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {/* From */}
                  <p 
                    className="text-white/50 tracking-wider mb-3"
                    style={{ fontWeight: 200, fontSize: '0.85rem' }}
                  >
                    FROM
                  </p>
                  <h3 
                    className="text-white tracking-wide mb-8"
                    style={{ fontWeight: 200, fontSize: '2rem' }}
                  >
                    {currentEmail?.from_email || 'Unknown'}
                  </h3>

                  {/* Subject */}
                  <p 
                    className="text-white/50 tracking-wider mb-3"
                    style={{ fontWeight: 200, fontSize: '0.85rem' }}
                  >
                    SUBJECT
                  </p>
                  <p 
                    className="text-white/90 tracking-wide mb-8"
                    style={{ fontWeight: 200, fontSize: '1.2rem', lineHeight: 1.6 }}
                  >
                    {currentEmail?.subject || 'No subject'}
                  </p>

                  {/* Summary */}
                  <p 
                    className="text-white/50 tracking-wider mb-3"
                    style={{ fontWeight: 200, fontSize: '0.85rem' }}
                  >
                    SUMMARY
                  </p>
                  <p 
                    className="text-white/70 tracking-wide mb-10"
                    style={{ fontWeight: 200, fontSize: '1rem', lineHeight: 1.7 }}
                  >
                    {currentEmail?.summary || currentEmail?.body || 'No summary available'}
                  </p>

                  {/* Editable Response */}
                  <p 
                    className="text-white/50 tracking-wider mb-3"
                    style={{ fontWeight: 200, fontSize: '0.85rem' }}
                  >
                    SUGGESTED RESPONSE
                  </p>
                  <textarea
                    value={responseDraft}
                    onChange={(e) => setResponseDraft(e.target.value)}
                    className="w-full px-6 py-4 rounded-xl border border-blue-500/30 bg-transparent text-white/90 tracking-wide resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
                    style={{ 
                      fontWeight: 200, 
                      fontSize: '1rem', 
                      lineHeight: 1.7,
                      background: 'rgba(59, 130, 246, 0.08)',
                      minHeight: '120px',
                    }}
                    rows={4}
                  />

                  {/* Send Button */}
                  <motion.button
                    onClick={handleSend}
                    disabled={sending}
                    whileHover={{ scale: sending ? 1 : 1.02 }}
                    whileTap={{ scale: sending ? 1 : 0.98 }}
                    className="w-full mt-6 px-6 py-4 rounded-xl border border-blue-500/40 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                    }}
                  >
                    <span 
                      className="text-white/90 tracking-wider"
                      style={{ fontWeight: 200, fontSize: '1rem' }}
                    >
                      {sending ? 'Sending…' : 'Send Response'}
                    </span>
                    <Send className="w-5 h-5 text-white/80" strokeWidth={1.5} />
                  </motion.button>
                </div>
              </motion.div>

              {/* Right Arrow */}
              <motion.button
                onClick={handleNext}
                disabled={currentIndex === emails.length - 1}
                whileHover={{ scale: currentIndex === emails.length - 1 ? 1 : 1.1 }}
                whileTap={{ scale: currentIndex === emails.length - 1 ? 1 : 0.95 }}
                className="p-4 rounded-full border border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity ml-8"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <ChevronRight className="w-6 h-6 text-white/70" strokeWidth={1.5} />
              </motion.button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
