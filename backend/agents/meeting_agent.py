from sync.calendar_sync import fetch_all_events, fetch_all_tasks
from sync.calendar_sync import get_calendar_service
from core.llm_client import summarize_text_from_calender
from core.supabase_client import insert_record
from datetime import datetime, timedelta, time as dtime
import pytz
import time

def parse_datetime_safe(dt_value, local_tz):
    """Convert datetime string/object → timezone-aware UTC datetime."""
    if not dt_value:
        return None
    try:
        if isinstance(dt_value, datetime):
            if dt_value.tzinfo is None:
                return local_tz.localize(dt_value).astimezone(pytz.UTC)
            return dt_value.astimezone(pytz.UTC)
        # Handle strings like "2025-11-07T14:00:00-05:00"
        dt = datetime.fromisoformat(dt_value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = local_tz.localize(dt)
        return dt.astimezone(pytz.UTC)
    except Exception:
        return None


def process_calendar_meetings():
    """Fetch today's meetings using local time (EST), but store all in UTC."""
    local_tz = pytz.timezone("America/New_York")

    calendar_service, tasks_service = get_calendar_service()
    meetings = fetch_all_events(calendar_service)

    # Define *local* window for today (EST)
    local_today = datetime.now(local_tz).date()
    start_local = local_tz.localize(datetime.combine(local_today, dtime.min))
    end_local = local_tz.localize(datetime.combine(local_today, dtime.max))

    events_today = []
    for m in meetings:
        start_time = parse_datetime_safe(m.get("start_time"), local_tz)
        if not start_time:
            continue

        # Convert to local for comparison
        start_localized = start_time.astimezone(local_tz)
        if start_local <= start_localized <= end_local:
            events_today.append(m)

    print(f"✅ Found {len(events_today)} meetings scheduled for today (local EST).\n")

    for m in events_today:
        text = f"{m['title']} — {m.get('description', '')}".strip()
        if not text:
            continue

        try:
            ai_output = summarize_text_from_calender(text)
        except Exception as e:
            if "429" in str(e):
                print("⚠️ Gemini rate limit hit. Waiting 20s before retry...")
                time.sleep(20)
                ai_output = summarize_text_from_calender(text)
            else:
                raise

        record = {
            "title": m["title"],
            "description": m.get("description", ""),
            "ai_summary": (
                ai_output.get("summary")
                if isinstance(ai_output, dict) and "summary" in ai_output
                else f"AI summary for {m['title']}"
            ),
            "action_items": (
                ai_output.get("action_items")
                if isinstance(ai_output, dict) and "action_items" in ai_output
                else ai_output
            ),
            # Always store UTC
            "start_time": parse_datetime_safe(m.get("start_time"), local_tz).isoformat() if m.get("start_time") else None,
            "end_time": parse_datetime_safe(m.get("end_time"), local_tz).isoformat() if m.get("end_time") else None,
            "attendees": m.get("attendees", []),
        }

        print(f"🪄 Inserting into Supabase: {record['title']} @ {record['start_time']}")
        insert_record("events", record)

    print("✅ All local-day (EST) meetings processed and stored as UTC in Supabase.\n")
