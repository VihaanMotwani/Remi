import json
import datetime
from core.supabase_client import fetch_records, insert_record
from core.llm_client import generate_morning_briefing
import subprocess
import os

def compile_daily_context():
    """
    Fetch all relevant context (emails, meetings, notes) for *today only*.
    """
    today = datetime.date.today()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    end_of_day = datetime.datetime.combine(today, datetime.time.max)

    print(f"📅 Fetching records created today ({start_of_day} → {end_of_day})")

    # Only pull records created today
    emails = fetch_records("emails", start=start_of_day, end=end_of_day)
    meetings = fetch_records("events", start=start_of_day, end=end_of_day)
    tasks = fetch_records("meeting_notes", start=start_of_day, end=end_of_day)

    print(f"📧 {len(emails)} emails | 📆 {len(meetings)} meetings | 🗒️ {len(tasks)} notes found.\n")

    context = {
        "emails": [
            {
                "subject": e.get("subject"),
                "summary": e.get("summary"),
                "action_items": e.get("action_items", []),
                "sentiment": e.get("sentiment", "neutral"),
                "timestamp": e.get("timestamp"),
            }
            for e in emails
        ],
        "meetings": [
            {
                "title": m.get("title"),
                "time": m.get("start_time"),
                "attendees": m.get("attendees", []),
                "priority": m.get("status", "Medium"),
                "location": m.get("location"),
            }
            for m in meetings
        ],
        "tasks": [
            {
                "task": t.get("summary"),
                "owner": None,
                "due_date": t.get("created_at"),
                "source": "meeting",
            }
            for t in tasks
        ],
    }

    return context


def print_readable_briefing(briefing: dict):
    """Neat, conversational printout for terminal debugging or console view."""
    print("\n🧭 ===== DAILY DIGEST =====")
    print(f"\n🌅 {briefing.get('greeting', 'Good morning!')}\n")

    # --- Urgent Tasks ---
    urgent = briefing.get("urgent_tasks", [])
    if urgent:
        print("🔥 URGENT TASKS:")
        for i, task in enumerate(urgent, 1):
            print(f"  {i}. {task.get('task')}")
            if task.get("owner"):
                print(f"     👤 Owner: {task['owner']}")
            if task.get("due_date"):
                print(f"     ⏰ Due: {task['due_date']}")
            print(f"     📎 Source: {task.get('source', 'N/A')}")
    else:
        print("✅ No urgent tasks today.")

    # --- Follow-Ups ---
    followups = briefing.get("follow_up_tasks", [])
    if followups:
        print("\n📋 FOLLOW-UPS / PENDING ACTIONS:")
        for i, task in enumerate(followups, 1):
            print(f"  {i}. {task.get('task')}")
            if task.get("context"):
                print(f"     💡 {task['context']}")
    else:
        print("\n📭 No pending follow-ups.")

    # --- Meetings ---
    meetings = briefing.get("meetings_today", [])
    if meetings:
        print("\n📅 MEETINGS TODAY:")
        for i, meet in enumerate(meetings, 1):
            print(f"  {i}. {meet.get('title')} @ {meet.get('time', 'TBD')}")
            if meet.get("attendees"):
                print(f"     👥 Attendees: {', '.join(meet['attendees'])}")
            if meet.get("location"):
                print(f"     📍 Location: {meet['location']}")
            print(f"     ⚡ Priority: {meet.get('priority', 'Medium')}")
    else:
        print("\n🗓️ No meetings scheduled for today.")

    # --- Summary ---
    print("\n🧩 SUMMARY:")
    print(f"  {briefing.get('summary_text', 'No summary available.')}")
    print("\n============================\n")


def generate_daily_briefing():
    print("🌅 Generating morning briefing...")
    context = compile_daily_context()
    briefing = generate_morning_briefing(context)

    record = {
        "greeting": briefing.get("greeting", "Good morning!"),
        "urgent_tasks": briefing.get("urgent_tasks", []),
        "follow_up_tasks": briefing.get("follow_up_tasks", []),
        "meetings_today": briefing.get("meetings_today", []),
        "summary_text": briefing.get("summary_text", ""),
        "date": datetime.datetime.now().isoformat(),
    }

    # Save to Supabase
    insert_record("daily_reports", record)

    # Save to file for Node.js iMessage sender
    with open("daily_report.json", "w") as f:
        json.dump(record, f, indent=2)

    print("\n✅ Morning briefing generated & exported to daily_report.json")

    
    script_path = os.path.join(os.path.dirname(__file__), "..", "core", "imessage_client", "send_imessage.js")
    result = subprocess.run(
        ["node", script_path],
        capture_output=True,
        text=True
    )

    print("📨 Daily briefing sent via iMessage!")