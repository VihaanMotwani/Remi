# from flask import Flask
# from apscheduler.schedulers.background import BackgroundScheduler
# from datetime import datetime
# from backend.core.orchestrator import run_daily_digest

# app = Flask(__name__)

# scheduler = BackgroundScheduler()

# # run every day at 8 AM
# scheduler.add_job(run_daily_digest, "cron", hour=8, minute=0)

# scheduler.start()
