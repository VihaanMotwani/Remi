from agents.email_agent import process_emails
from agents.meeting_agent import process_calendar_meetings
from agents.daily_agent import generate_daily_briefing

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

    # Step 3 — Generate and Send Morning Briefing
    print("🌅 Step 3: Generating AI morning briefing...")
    success = generate_daily_briefing()

    if success:
        print("✅ Morning briefing generated, saved, and sent via iMessage.\n")
    else:
        print("⚠️ Morning briefing generated but message may not have been sent.\n")

    print("🏁 Pipeline complete — Remi is up to date!")


if __name__ == "__main__":
    main()
