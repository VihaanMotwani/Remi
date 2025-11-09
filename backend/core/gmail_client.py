"""
core/gmail_client.py
--------------------
Send plain-text emails via the Gmail API.
Requires valid OAuth token stored in `token_gmail.json`.
"""

import os
import base64
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Gmail API scope for sending mail
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_FILE = "token_gmail.json"


def get_gmail_service():
    """Authenticate with Gmail API and return service object."""
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(
            "⚠️ Gmail token file not found. Run OAuth flow first (token_gmail.json)."
        )

    creds = Credentials.from_authorized_user_file(TOKEN_FILE, GMAIL_SCOPES)
    service = build("gmail", "v1", credentials=creds)
    return service


def send_email(to_email: str, subject: str, body: str, sender: str = "me"):
    """
    Send a plain-text email using Gmail API.
    """
    try:
        service = get_gmail_service()

        # Create MIME message
        message = MIMEText(body, "plain")
        message["to"] = to_email
        message["subject"] = subject

        # Encode message to base64 for Gmail API
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        send_body = {"raw": raw_message}

        sent_message = (
            service.users().messages().send(userId=sender, body=send_body).execute()
        )

        print(f"✅ Email sent to {to_email} (Message ID: {sent_message['id']})")
        return sent_message

    except Exception as e:
        print(f"❌ Error sending email to {to_email}: {e}")
        return None
    
def reply_to_thread(
    to_email: str,
    subject: str,
    body: str,
    thread_id: str,
    message_id: str,
    sender: str = "me"
):
    """
    Reply to an existing Gmail thread.
    Args:
        to_email: recipient's email
        subject: subject (e.g. "Re: Project Update")
        body: plain text body
        thread_id: Gmail thread ID (from API)
        message_id: original Message-ID of the email you're replying to
        sender: default 'me' (authenticated user)
    """
    try:
        service = get_gmail_service()

        # Construct MIME reply
        message = MIMEText(body, "plain")
        message["to"] = to_email
        message["subject"] = subject
        message["In-Reply-To"] = message_id
        message["References"] = message_id

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        # Include the threadId in the send call
        send_body = {"raw": raw_message, "threadId": thread_id}

        sent = service.users().messages().send(userId=sender, body=send_body).execute()
        print(f"✅ Reply sent in thread {thread_id} (Message ID: {sent['id']})")
        return sent

    except Exception as e:
        print(f"❌ Error replying to thread {thread_id}: {e}")
        return None
