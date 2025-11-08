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
                port=0,
                access_type="offline",
                prompt="select_account"
            )
            with open(token_file, "w") as token:
                token.write(creds.to_json())

    calendar_service = build("calendar", "v3", credentials=creds)
    tasks_service = build("tasks", "v1", credentials=creds)
    return calendar_service, tasks_service


# =========================
# 🕒 HELPERS
# =========================
def normalize_datetime(dt_str):
    """Convert ISO or date-only strings to timezone-aware UTC datetimes."""
    if not dt_str:
        return None
    try:
        if "T" in dt_str:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)
        return datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def get_time_window():
    """Return timeMin and timeMax for today and tomorrow in RFC3339 format."""
    now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    tomorrow = now + timedelta(days=1)
    day_after = tomorrow + timedelta(days=1)
    return now.isoformat(), day_after.isoformat()


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
            start = normalize_datetime(
                e.get("start", {}).get("dateTime") or e.get("start", {}).get("date")
            )
            end = normalize_datetime(
                e.get("end", {}).get("dateTime") or e.get("end", {}).get("date")
            )
            attendees = [a["email"] for a in e.get("attendees", [])] if "attendees" in e else []

            all_events.append(
                {
                    "calendar_id": cal_id,
                    "title": e.get("summary", "No title"),
                    "description": e.get("description", ""),
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
        # print(service.tasklists().list().execute())
        task_lists = service.tasklists().list(maxResults=50).execute().get("items", [])
        for tl in task_lists:
            tasks = service.tasks().list(tasklist=tl["id"]).execute().get("items", [])
            for t in tasks:
                due = normalize_datetime(t.get("due"))
                if due and dt_min <= due < dt_max:
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
    print(f"📅 Fetched {len(combined)} calendar items total.")
    return combined


if __name__ == "__main__":
    # Just preview results (no DB upload)
    items = get_calendar_items()
    for i, item in enumerate(items[:5]):
        print(f"{i+1}. {item['title']} — {item['description'][:80]}")
