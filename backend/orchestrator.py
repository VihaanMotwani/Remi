from agents.email_agent import process_emails
from agents.meeting_agent import process_calendar_meetings
from agents.daily_agent import generate_daily_briefing
from core.mic_client import listen_and_route
import threading
import time

def _run_state_server():
    """Run FastAPI (uvicorn) state server on port 8000 in the background."""
    try:
        import uvicorn
        uvicorn.run("core.server:app", host="0.0.0.0", port=8000, log_level="info")
    except Exception as e:
        print(f"⚠️ Failed to start state server: {e}")

def main():
    print("🚀 Starting Remi AI Daily Workflow...\n")

    # Start WebSocket state server
    server_thread = threading.Thread(target=_run_state_server, daemon=True)
    server_thread.start()
    time.sleep(0.5)  # small delay to allow server to boot

    # Step 1 — Process Emails
    process_emails()
    print("✅ Emails processed successfully.\n")

    # Step 2 — Process Calendar Meetings
    print("🗓️ Step 2: Syncing and analyzing meetings...")
    process_calendar_meetings()
    print("✅ Calendar meetings processed successfully.\n")

    #Step 3 — Generate Morning Briefing (optional)
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
