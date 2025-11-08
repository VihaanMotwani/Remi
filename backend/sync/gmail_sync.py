"""
gmail_sync.py
-------------
Fetches unread Gmail messages (headers + body) and returns structured dictionaries.
Acts purely as a data source for email_agent.py instead of pushing to Supabase directly.
"""

from __future__ import print_function
import os
import base64
from datetime import datetime, timezone
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# =========================
# 🔧 CONFIGURATION
# =========================
load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",   # needed to mark as read
    "https://www.googleapis.com/auth/gmail.send",     # if you send emails
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/tasks.readonly"
]



# =========================
# 🔐 AUTHENTICATION
# =========================
def get_gmail_service():
    """Authenticate and return a Gmail API service instance."""
    creds = None
    token_file = "token_gmail.json"

    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "client_secret.json", SCOPES
            )
            creds = flow.run_local_server(
                port=0,
                access_type="offline",
                prompt="select_account"
            )
            with open(token_file, "w") as token:
                token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


# =========================
# 🧩 BODY EXTRACTION HELPER
# =========================
def extract_body(payload):
    """Extract plain text or HTML body from a Gmail message payload."""
    # Case 1: single-part message
    if "data" in payload.get("body", {}):
        data = payload["body"]["data"]
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

    # Case 2: multipart message
    if "parts" in payload:
        for part in payload["parts"]:
            mime_type = part.get("mimeType", "")
            data = part.get("body", {}).get("data")
            if data:
                decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                if "text/plain" in mime_type:
                    return decoded
                elif "text/html" in mime_type:
                    try:
                        return BeautifulSoup(decoded, "html.parser").get_text(" ", strip=True)
                    except Exception:
                        return decoded
    # Fallback: empty string
    return ""


# =========================
# 📩 FETCH UNREAD EMAILS
# =========================
def fetch_unread_messages(service, max_results=50, ascending=True):
    """
    Fetch unread Gmail messages (headers + body) and return clean list of dicts.
    """
    all_messages = []
    next_page_token = None

    while True:
        results = service.users().messages().list(
            userId="me",
            q="is:unread",
            maxResults=max_results,
            pageToken=next_page_token
        ).execute()

        msgs = results.get("messages", [])
        all_messages.extend(msgs)
        next_page_token = results.get("nextPageToken")

        if not next_page_token:
            break

    detailed = []
    for m in all_messages:
        msg = service.users().messages().get(
            userId="me",
            id=m["id"],
            format="full"  # ✅ fetch full body content
        ).execute()

        internal_ms = int(msg.get("internalDate", "0"))
        payload = msg.get("payload", {})
        headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

        frm = headers.get("From", "(no sender)")
        to = headers.get("To", "")
        cc = headers.get("Cc", "")
        subj = headers.get("Subject", "(no subject)")
        date_hdr = headers.get("Date", "")
        dt = datetime.fromtimestamp(internal_ms / 1000.0, tz=timezone.utc)

        body_text = extract_body(payload)

        detailed.append({
            "id": msg["id"],
            "datetime": dt,
            "from": frm,
            "to": [addr.strip() for addr in to.split(",")] if to else [],
            "cc": [addr.strip() for addr in cc.split(",")] if cc else [],
            "subject": subj,
            "body": body_text.strip(),
            "date_header": date_hdr,
        })

    detailed.sort(key=lambda x: x["datetime"], reverse=not ascending)
    return detailed


# =========================
# 🚀 FETCH WRAPPER
# =========================
def get_unread_emails():
    """Fetch unread Gmail messages for the AI pipeline (no Supabase writes)."""
    service = get_gmail_service()
    messages = fetch_unread_messages(service, ascending=False)

    print(f"📬 Retrieved {len(messages)} unread messages.")
    return messages


# =========================
# 🧪 DEBUG PREVIEW
# =========================
if __name__ == "__main__":
    emails = get_unread_emails()
    for i, e in enumerate(emails[:5]):
        print(f"{i+1}. {e['subject']} — from {e['from']}")
        print(f"   Body preview: {e['body'][:200]!r}\n")
