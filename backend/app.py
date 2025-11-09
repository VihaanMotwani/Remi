# from flask import Flask
# from apscheduler.schedulers.background import BackgroundScheduler
# from datetime import datetime
# from backend.core.orchestrator import run_daily_digest

# app = Flask(__name__)

# scheduler = BackgroundScheduler()

# # run every day at 8 AM
# scheduler.add_job(run_daily_digest, "cron", hour=8, minute=0)

# scheduler.start()
from core.gmail_client import send_email

def send_test_email():
    to = "grovertanya17@gmail.com"
    subject = "Hello from Remi 👋"
    body = (
        "Hey there!\n\n"
        "This is a test email sent from your Remi AI assistant.\n"
        "We're reimagining the workplace — one email at a time.\n\n"
        "— The Remi Team"
    )
    send_email(to, subject, body)
