from sync.gmail_sync import fetch_unread_messages, get_gmail_service
from core.llm_client import summarize_text_from_email
from core.supabase_client import insert_record
from datetime import datetime
import time

VALID_SENTIMENTS = {"neutral", "urgent", "positive", "negative"}
VALID_CATEGORIES = {"Administrative", "Informational", "External Communication", "Project Update", "Other"}

def process_emails():
    service = get_gmail_service()
    emails = fetch_unread_messages(service, ascending=False)  # make sure this returns body/snippet

    for email in emails:
        body = email.get("body") or email.get("snippet") or ""
        text = f"""Subject: {email.get('subject','')}
From: {email.get('from','')}
Date: {email.get('datetime')}
Body:
{body}"""
        
        try:
            ai_output = summarize_text_from_email(text)
        except Exception as e:
            if "429" in str(e):
                print("⚠️ Gemini rate limit hit. Waiting 20s before retry...")
                time.sleep(20)
                ai_output = summarize_text_from_email(text)
            else:
                raise

        sentiment = ai_output.get("sentiment", "neutral")
        if sentiment not in VALID_SENTIMENTS:
            sentiment = "neutral"

        category = ai_output.get("category", "Informational")
        if category not in VALID_CATEGORIES:
            category = "Informational"

        action_items = ai_output.get("action_items") or ai_output.get("action items") or []
        if not isinstance(action_items, list):
            action_items = []

        record = {
            "subject": email.get("subject", ""),
            "from_email": email.get("from", ""),
            "summary": ai_output.get("summary", ""),
            "action_items": action_items,
            "sentiment": sentiment,
            "category": category,
            "timestamp": email["datetime"].isoformat(),
            "response": ai_output.get("response", ""),
        }

        try:
            insert_record("emails", record)
            print(f"✅ Inserted into emails: {record['subject']}")
        except Exception as db_err:
            print(f"❌ Error inserting into emails: {db_err}")
            # Continue processing next emails without stopping
            continue

        # ✅ Mark email as read once processed
        try:
            service.users().messages().modify(
                userId="me",
                id=email["id"],
                body={"removeLabelIds": ["UNREAD"]}
            ).execute()
            print(f"📭 Marked as read: {email.get('subject', '')}")
        except Exception as err:
            print(f"⚠️ Could not mark as read ({email.get('subject', '')}): {err}")
