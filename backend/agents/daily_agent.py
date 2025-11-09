import json
import datetime
import subprocess
import os

# ✅ Import only external dependencies and core modules — NO self-imports
from core.supabase_client import fetch_records, insert_record
from core.llm_client import generate_morning_briefing

# ==========================================================
# 📦 COMPILE CONTEXT
# ==========================================================
def compile_daily_context():
    today = datetime.date.today()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    end_of_day = datetime.datetime.combine(today, datetime.time.max)

    print(f"📅 Fetching records created today ({start_of_day} → {end_of_day})")

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

def generate_daily_briefing():
    print("🌅 Generating morning briefing...")
    context = compile_daily_context()

    # 🧠 Get the text-based morning summary
    briefing_text = generate_morning_briefing(context)

    # 🗃️ Save to Supabase (as text)
    record = {
        "summary_text": briefing_text,
        "created_at": datetime.datetime.now().isoformat(),
    }
    insert_record("daily_reports", record)

    # 💾 Save locally for Node.js iMessage sender
    with open("daily_briefing.txt", "w") as f:
        f.write(briefing_text)

    print("\n✅ Morning briefing generated & saved to daily_briefing.txt")

    # 💬 Trigger Node.js iMessage sender
    script_path = os.path.join(
        os.path.dirname(__file__), "..", "core", "imessage_client", "send_imessage.js"
    )
    result = subprocess.run(
        ["node", script_path],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("📨 Daily briefing sent via iMessage successfully!")
    else:
        print(f"⚠️ iMessage sending failed:\n{result.stderr}")
