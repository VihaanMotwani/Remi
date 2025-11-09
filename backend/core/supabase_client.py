# core/supabase_client.py
from supabase import create_client
import os
import datetime
from typing import Optional
from dotenv import load_dotenv
load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def record_exists(table: str, filters: dict) -> bool:
    """Check if a record already exists in a table by a filter (e.g., same subject/date)."""
    try:
        query = supabase.table(table).select("id").limit(1)
        for k, v in filters.items():
            query = query.eq(k, v)
        result = query.execute()
        return bool(result.data)
    except Exception as e:
        print(f"⚠️ Record existence check failed for {table}: {e}")
        return False

def insert_record(table: str, record: dict):
    """Insert record into Supabase only if it doesn't already exist for today."""
    try:
        today = datetime.date.today()
        start_of_day = datetime.datetime.combine(today, datetime.time.min)
        end_of_day = datetime.datetime.combine(today, datetime.time.max)

        # Check for duplicates based on key fields
        check_query = supabase.table(table).select("*").gte("created_at", start_of_day.isoformat()).lte("created_at", end_of_day.isoformat())

        # Add unique matching filters
        if "title" in record:
            check_query = check_query.eq("title", record["title"])
        elif "subject" in record:
            check_query = check_query.eq("subject", record["subject"])

        existing = check_query.execute().data
        if existing:
            print(f"⚠️ Skipping duplicate insert for '{record.get('title') or record.get('subject')}' — already exists today.")
            return None

        # Proceed with insert
        response = supabase.table(table).insert(record).execute()
        print(f"✅ Inserted into {table}: {record.get('title') or record.get('subject')}")
        return response.data
    except Exception as e:
        print(f"❌ Error inserting into {table}: {e}")
        return None

def fetch_records(table: str, start=None, end=None, limit=50):
    """Fetch records created between start and end timestamps (for daily digest), using local timezone (EST)."""
    from datetime import datetime, time as dtime
    import pytz

    try:
        local_tz = pytz.timezone("America/New_York")

        # Default to today's local EST window if not provided
        if not start or not end:
            local_today = datetime.now(local_tz).date()
            start = local_tz.localize(datetime.combine(local_today, dtime.min))
            end = local_tz.localize(datetime.combine(local_today, dtime.max))

        # Convert both to UTC before querying Supabase (DB stores UTC)
        start_utc = start.astimezone(pytz.UTC)
        end_utc = end.astimezone(pytz.UTC)

        query = (
            supabase.table(table)
            .select("*")
            .gte("created_at", start_utc.isoformat())
            .lte("created_at", end_utc.isoformat())
            .limit(limit)
        )

        result = query.execute()
        data = result.data or []
        print(f"📥 Retrieved {len(data)} records from '{table}'")
        return data

    except Exception as e:
        print(f"❌ Error fetching {table}: {e}")
        return []
