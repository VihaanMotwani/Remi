from sync.gmail_sync import fetch_unread_messages, get_gmail_service
from core.llm_client import summarize_text_from_email
from core.supabase_client import insert_record
from core.llm_client import suggest_email_reply
from datetime import datetime, timezone
from core.llm_client import suggest_email_reply
import time

VALID_SENTIMENTS = {"neutral", "urgent", "positive", "negative"}
VALID_CATEGORIES = {"Administrative", "Informational", "External Communication", "Project Update", "Other"}
"""
email_agent.py
--------------
Fetch unread Gmail messages → summarize content → store in Supabase → generate suggested replies.
Ensures each email is processed only once per day.
"""

def process_emails():
    print("📧 Step 1: Processing unread emails...")
    service = get_gmail_service()
    emails = fetch_unread_messages(service, ascending=False)
    if not emails:
        print("📭 No new unread emails found.")
        return

    for e in emails:
        try:
            body = e.get("body") or "(no content)"
            text_for_llm = (
                f"Subject: {e.get('subject','(no subject)')}\n"
                f"From: {e.get('from','')}\n"
                f"To: {', '.join(e.get('to', []))}\n"
                f"Date: {e.get('datetime')}\n\n"
                f"{body}"
            )

            # 🧠 Summarize
            try:
                ai_summary = summarize_text_from_email(text_for_llm)
            except Exception as err:
                if "429" in str(err):
                    print("⚠️ Rate limit. Sleeping 20s…")
                    time.sleep(20)
                    ai_summary = summarize_text_from_email(text_for_llm)
                else:
                    raise

            # 🧠 Suggest reply draft
            suggestion = suggest_email_reply(body)  # returns {reply, tone, confidence}

            # 🗄️ Insert one row with the draft reply in `response`
            record = {
                "message_id": e.get("id") or e.get("thread_id"),
                "thread_id": e.get("thread_id"),
                "from_email": e["from"],
                "to_email": e.get("to", []),
                "cc": e.get("cc", []),
                "subject": e.get("subject"),
                "summary": ai_summary.get("summary", ""),
                "action_items": ai_summary.get("action_items", []),
                "sentiment": ai_summary.get("sentiment", "neutral"),
                "category": ai_summary.get("category", "Informational"),
                "timestamp": e["datetime"].isoformat() if isinstance(e["datetime"], datetime) else None,

                # 👇 store the suggested reply here
                "response": suggestion.get("reply", ""),   # <— suggested reply draft
                "replied_to": False,                       # <— not sent yet
            }

            insert_record("emails", record)

            # ✅ Mark Gmail message as read
            try:
                service.users().messages().modify(
                    userId="me", id=e["id"],
                    body={"removeLabelIds": ["UNREAD"]}
                ).execute()
                print(f"📭 Marked as read: {e['subject']}")
            except Exception as mark_err:
                print(f"⚠️ Could not mark as read ({e['subject']}): {mark_err}")

        except Exception as err:
            print(f"❌ Error processing '{e.get('subject','(no subject)')}': {err}")

    print("✅ Emails processed.\n")