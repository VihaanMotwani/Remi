import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Communications.module.css";
import {
  fetchUnrespondedEmails,
  // saveEmailDraft,
  logSentEmail,
  sendEmailViaGmail,
  saveDraftViaGmail,
  Email,
} from "../../api/emailsClient";

export default function Communications() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responseDraft, setResponseDraft] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>(""); // Still needs implementation

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

  const handleSaveDraft = async () => {
    if (!current || !responseDraft) return;
    //TODO: Save to DB
  };

  const handleSend = async () => {
    if (!current || !responseDraft) return;
    try {
      if (accessToken) {
        await sendEmailViaGmail(accessToken, current.to_email, current.subject, responseDraft);
      }
      await logSentEmail(current.id, responseDraft);
      // alert("Email sent successfully!");
      // Automatically advance to the next email after sending
      handleNext(); 
    } catch (error) {
      console.error(error);
      // alert("Error sending email.");
    }
  };

  if (loading) return <div className={styles.empty}>Loading emails...</div>;
  if (emails.length === 0)
    return <div className={styles.empty}>No pending emails to respond to.</div>;

  return (
    <div className={styles.container}>
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
              <button onClick={handleSend} className={styles.sendButton} disabled={!responseDraft}>Send</button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button onClick={handleNext} className={styles.arrowButton}>→</button>
    </div>
  );
}