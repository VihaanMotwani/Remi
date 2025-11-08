import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Communications.module.css";
import { Email } from "../../types";
import { fetchUnrespondedEmails, updateEmailResponse } from "../../api/messagesClient";




export default function Communications() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responseDraft, setResponseDraft] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadEmails = async () => {
      try {
        const data = await fetchUnrespondedEmails();
        setEmails(data);
        if (data.length > 0) {
            setResponseDraft(data[0].response || ""); 
        }
      } catch (error) {
        console.error("Error loading emails:", error);
      } finally {
        setLoading(false);
      }
    };
    loadEmails();
  }, []);

  const current = emails[index];
  
  // Helper function to set state for the new email
  const updateCurrentEmail = (newIndex: number) => {
    setIndex(newIndex);
    // Use optional chaining just in case
    setResponseDraft(emails[newIndex]?.response || "");
  }

  const handleNext = () => {
    const newIndex = (index + 1) % emails.length;
    updateCurrentEmail(newIndex);
  };

  const handlePrev = () => {
    const newIndex = (index - 1 + emails.length) % emails.length;
    updateCurrentEmail(newIndex);
  };

  // const handleSaveDraft = async () => {
  //   if (!current || !responseDraft) return;
  //   //TODO: Save to DB
  // };


const handleSend = async () => {
  try {
    const response = await fetch('https://remi-q7gs.onrender.com/send-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: emails[index].thread_id,
        to: emails[index].to_email,
        from: emails[index].from_email,
        body: responseDraft,
      }),
    });

    console.log(response);
    console.log('Sending reply with:', {
      threadId: emails[index]?.thread_id,
      to: emails[index]?.to_email,
      from: emails[index]?.from_email,
      body: responseDraft,
    });


    const result = await response.json();

    if (result.success) {
      console.log('Reply sent successfully!');
      await updateEmailResponse(emails[index].thread_id, responseDraft);
      // Remove the sent email from the list
      const updatedEmails = emails.filter((_, i) => i !== index);
      setEmails(updatedEmails);
      // Update index and draft
      if (updatedEmails.length === 0) {
        setIndex(0);
        setResponseDraft("");
      } else {
        const newIndex = index % updatedEmails.length;
        setIndex(newIndex);
        setResponseDraft(updatedEmails[newIndex]?.response || "");
      }
    } else {
      console.error('Send failed:', result.error);
    }
  } catch (error) {
    console.error('Network or server error:', error);
  } finally {
    setSending(false);
  }
};

  if (loading) return <div className={styles.empty}>Loading emails...</div>;
  if (emails.length === 0)
    return <div className={styles.empty}>No pending emails to respond to.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <button onClick={handlePrev} className={styles.arrowButton}>←</button>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            className={styles.mailCard}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div><strong>From:</strong> {current.from_email || "—"}</div>
              <div><strong>To:</strong> {current.to_email?.join(", ") || "—"}</div>
              <div><strong>Subject:</strong> {current.subject || "—"}</div>
              {current.timestamp && (
                <div><strong>Received:</strong> {new Date(current.timestamp).toLocaleString()}</div>
              )}
            </div>

            {/* Summary Section */}
            {current.summary && (
              <motion.div
                className={styles.summaryBox}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <strong>Summary:</strong>
                <p>{current.summary}</p>
              </motion.div>
            )}

            {/* Full Body */}
            <motion.div
              className={styles.body}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {current.body || "No message body available."}
            </motion.div>

            {/* Response Section: Note h4 instead of h3 */}
            <div className={styles.responseSection}>
              <h4 className={styles.responseHeading}>Suggested Response</h4>
              <textarea
                className={styles.responseBox}
                placeholder="Type or edit your response..."
                value={responseDraft}
                onChange={(e) => setResponseDraft(e.target.value)}
              />
              <div className={styles.responseActions}>
              <button
                className={styles.sendButton}
                disabled={!responseDraft || sending}
                onClick={() => {
                  setSending(true);
                  handleSend();
                }}
              >
                Send
              </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <button onClick={handleNext} className={styles.arrowButton}>→</button>
      </div>
      <div className={styles.emailCounter}>
        {index + 1} / {emails.length}
      </div>
    </div>
  );
}