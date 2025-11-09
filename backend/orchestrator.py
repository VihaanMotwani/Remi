from agents.email_agent import process_emails
from agents.meeting_agent import process_calendar_meetings
from agents.daily_agent import generate_daily_briefing
from core.mic_client import listen_and_route

def main():
    print("🚀 Starting Remi AI Daily Workflow...\n")

    # Step 1 — Process Emails
    print("📧 Step 1: Processing emails...")
    process_emails()
    print("✅ Emails processed successfully.\n")

    # Step 2 — Process Calendar Meetings
    print("🗓️ Step 2: Syncing and analyzing meetings...")
    process_calendar_meetings()
    print("✅ Calendar meetings processed successfully.\n")

    # Step 3 — Generate Morning Briefing
    print("🌅 Step 3: Generating AI morning briefing...")
    success = generate_daily_briefing()

    if success:
        print("✅ Morning briefing generated and saved successfully.\n")
    else:
        print("⚠️ Morning briefing generated but may not have been sent.\n")

    # Step 4 — Voice Agent Interaction (real-time)
    print("🎙 Step 4: Activating Remi voice interface...")
    listen_and_route()

    print("🏁 Workflow complete — Remi is up to date and responsive!\n")


if __name__ == "__main__":
    main()
