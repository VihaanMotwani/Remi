"""
calendar_sync.py
----------------
Fetches Google Calendar events and Google Tasks (due today/tomorrow)
and returns them as clean Python dictionaries for the meeting_agent to process.
"""

from __future__ import print_function
import os
from datetime import datetime, timezone, timedelta
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from dotenv import load_dotenv
import json
import re

# =========================
# 🔧 LOAD CONFIG
# =========================
load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/tasks.readonly",
]


# =========================
# 🔐 AUTHENTICATION
# =========================
def get_calendar_service():
    """Authenticate and return Google Calendar + Tasks clients."""
    creds = None
    token_file = "token_calendar.json"

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
                port=0, access_type="offline", prompt="select_account"
            )
            with open(token_file, "w") as token:
                token.write(creds.to_json())

    calendar_service = build("calendar", "v3", credentials=creds)
    tasks_service = build("tasks", "v1", credentials=creds)
    return calendar_service, tasks_service


# =========================
# 🕒 HELPERS
# =========================
from datetime import datetime, timezone
import dateutil.parser

from datetime import datetime, timezone
import dateutil.parser

def normalize_datetime(dt_str):
    """Convert any Google Calendar datetime to timezone-aware UTC."""
    if not dt_str:
        return None
    try:
        dt = dateutil.parser.isoparse(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception as e:
        print(f"⚠️ normalize_datetime failed for {dt_str}: {e}")
        return None


def get_time_window():
    """Return ISO8601 UTC time range from today 00:00 UTC to day after tomorrow 00:00 UTC."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_after_tomorrow = today_start + timedelta(days=2)
    return today_start.isoformat(), day_after_tomorrow.isoformat()


def clean_html(raw_html: str) -> str:
    """Remove HTML tags from Google Calendar descriptions."""
    if not raw_html:
        return ""
    clean = re.compile("<.*?>")
    return re.sub(clean, "", raw_html).strip()


# =========================
# 🗓️ FETCH CALENDAR EVENTS
# =========================
def fetch_all_events(service):
    """Fetch events starting from today 00:00 UTC to day after tomorrow 00:00 UTC (primary calendar only)."""
    all_events = []
    time_min, time_max = get_time_window()

    try:
        calendar_list = service.calendarList().list().execute()
    except Exception as e:
        print(f"⚠️ Failed to fetch calendar list: {e}")
        return all_events

    for cal in calendar_list.get("items", []):
        # ✅ Only fetch events from the primary calendar
        if not cal.get("primary"):
            continue

        cal_id = cal["id"]
        print(f"📅 Fetching events from primary calendar: {cal_id}")

        try:
            events = (
                service.events()
                .list(
                    calendarId=cal_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
                .get("items", [])
            )
        except Exception as e:
            print(f"⚠️ Failed to fetch events for {cal_id}: {e}")
            continue

        for e in events:
            start = normalize_datetime(e["start"].get("dateTime", e["start"].get("date")))

            end = normalize_datetime(
                e.get("end", {}).get("dateTime") or e.get("end", {}).get("date")
            )

            attendees = [a["email"] for a in e.get("attendees", [])] if "attendees" in e else []

            all_events.append(
                {
                    "calendar_id": cal_id,
                    "title": e.get("summary", "No title"),
                    "description": clean_html(e.get("description", "")),
                    "is_task": False,
                    "start_time": start,
                    "end_time": end,
                    "attendees": attendees,
                    "location": e.get("location", None),
                }
            )

    print(f"✅ Total events fetched from primary calendar: {len(all_events)}")
    return all_events


# =========================
# ✅ FETCH TASKS
# =========================
def fetch_all_tasks(service):
    """Fetch tasks with due dates within today and tomorrow."""
    all_tasks = []
    time_min, time_max = get_time_window()
    dt_min = datetime.fromisoformat(time_min)
    dt_max = datetime.fromisoformat(time_max)

    try:
        task_lists = service.tasklists().list(maxResults=50).execute().get("items", [])
        for tl in task_lists:
            tasks = service.tasks().list(tasklist=tl["id"]).execute().get("items", [])
            for t in tasks:
                due = normalize_datetime(t.get("due"))
                if due and dt_min <= due <= dt_max:
                    all_tasks.append({
                        "calendar_id": tl["id"],
                        "title": t.get("title", "(no title)"),
                        "description": t.get("notes", ""),
                        "is_task": True,
                        "start_time": None,
                        "end_time": due,
                        "attendees": [],
                        "location": None,
                    })
    except Exception as e:
        print(f"⚠️ Error fetching tasks: {e}")
    return all_tasks


# =========================
# 🚀 MAIN FETCH WRAPPER
# =========================
def get_calendar_items():
    """Fetch all events and tasks for today and tomorrow."""
    calendar_service, tasks_service = get_calendar_service()
    events = fetch_all_events(calendar_service)
    tasks = fetch_all_tasks(tasks_service)

    combined = events + tasks
    print(f"📅 Fetched {len(events)} events and {len(tasks)} tasks ({len(combined)} total).")
    return combined


if __name__ == "__main__":
    items = get_calendar_items()
    print("\n🧩 Sample fetched items:")
    for i, item in enumerate(items[:5]):
        print(json.dumps(item, indent=2, default=str))
