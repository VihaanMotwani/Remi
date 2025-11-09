from sync.calendar_sync import fetch_all_events, fetch_all_tasks
from sync.calendar_sync import get_calendar_service
from core.llm_client import summarize_text_from_meeting
from core.llm_client import summarize_text_from_calender
from core.supabase_client import insert_record
import datetime
import time

def parse_datetime_safe(dt_value):
    """Convert Google Calendar datetime string or object to timezone-naive datetime."""
    if not dt_value:
        return None
    if isinstance(dt_value, datetime.datetime):
        return dt_value.replace(tzinfo=None)
    try:
        # Handle strings like "2025-11-07T14:00:00-05:00"
        return datetime.datetime.fromisoformat(dt_value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None

def process_calendar_meetings():
    """Fetch today's meetings from Google Calendar, summarize with Gemini, and insert into Supabase."""
    calendar_service, tasks_service = get_calendar_service()
    meetings = fetch_all_events(calendar_service)
    #tasks = fetch_all_tasks(tasks_service)
    events = meetings #+ tasks

    # 🕒 Filter for today's events only
    today = datetime.date.today()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    end_of_day = datetime.datetime.combine(today, datetime.time.max)

    events_today = []
    for m in events:
        start_time = parse_datetime_safe(m.get("start_time"))
        if not start_time:
            continue
        if start_of_day <= start_time <= end_of_day:
            events_today.append(m)

    print(f"🗓️ Found {len(events_today)} meetings scheduled for today.\n")

    # 🧠 Process each meeting
    for m in events_today:
        text = f"{m['title']} — {m.get('description', '')}".strip()
        if not text or text == "No title — ":
            continue  # skip placeholders

        try:
            ai_output = summarize_text_from_calender(text)
        except Exception as e:
            if "429" in str(e):
                print("⚠️ Gemini rate limit hit. Waiting 20s before retry...")
                time.sleep(20)
                ai_output = summarize_text_from_calender(text)
            else:
                raise

        print(f"🔹 AI output for '{m['title']}':", ai_output)

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
            "start_time": (
                parse_datetime_safe(m.get("start_time")).isoformat()
                if m.get("start_time")
                else None
            ),
            "end_time": (
                parse_datetime_safe(m.get("end_time")).isoformat()
                if m.get("end_time")
                else None
            ),
            "attendees": m.get("attendees", []),
        }

        try:
            insert_record("events", record)
        except Exception as e:
            print(f"⚠️ Supabase insert failed for {m['title']}: {e}")

    print("✅ Today's meetings processed and inserted into Supabase.\n")
