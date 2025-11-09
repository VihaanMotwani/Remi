"""
Neo4j Loader for Remi Operational Data

Mirrors PostgreSQL tables (persons, meetings, emails, tasks, topics) into Neo4j Aura with clean label/relationship mapping, optional embeddings, and safe idempotent upserts.

How to run:
    python -m neo4j_loader.loader [--full|--since ISO_DATETIME] [--batch-size N] [--skip-embeddings]

Features:
- Reads config from env vars (see config.py)
- Bootstraps Neo4j schema (constraints, vector indexes)
- Fetches rows from Postgres in batches
- Upserts nodes and relationships with MERGE (idempotent)
- Optional embeddings for text fields
- Logs counts, durations, warnings, errors

See config.py for mapping details.
"""

# ...implementation will follow...
import os
import sys
import argparse
import time
from datetime import datetime
from neo4j import GraphDatabase
import requests
import re
from .config import (
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    NEO4J_URI, NEO4J_USER, NEO4J_PASS,
    EMBEDDINGS_PROVIDER, EMBEDDINGS_MODEL, EMBEDDINGS_DIM,
    NODE_LABELS, RELATIONSHIP_TYPES
)
import re
from openai import OpenAI
from dotenv import load_dotenv


load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBED_MODEL = os.environ.get("EMBEDDINGS_MODEL", "text-embedding-3-small")
EMBED_DIM   = int(os.environ.get("EMBEDDINGS_DIM", "1536"))
USE_EMBEDS = os.environ.get("EMBEDDINGS_PROVIDER", "openai").lower() != "none"
client = OpenAI(api_key=OPENAI_API_KEY) if USE_EMBEDS else None

# --- Embedding stub ---
def embed(text: str) -> list:
    txt = (text or "").strip()
    if not USE_EMBEDS or not txt:
        return [0.0] * EMBED_DIM
    for attempt in range(3):
        try:
            resp = client.embeddings.create(model=EMBED_MODEL, input=txt)
            return resp.data[0].embedding
        except Exception as e:
            if attempt == 2:
                print(f"[ERROR] OpenAI embedding failed: {e}")
                return [0.0] * EMBED_DIM
            time.sleep(0.6 * (attempt + 1))

_EMAIL_RX = re.compile(r'<([^>]+)>$')
def _norm_email(s: str|None) -> str|None:
    if not s: return None
    s = s.strip().strip('"').strip()
    m = _EMAIL_RX.search(s)
    return m.group(1).lower() if m else s.lower()

def _to_iso(val) -> str|None:
    if val is None: return None
    if isinstance(val, str): return val
    if isinstance(val, datetime): return val.isoformat()
    return str(val)

# --- Neo4j Schema Bootstrap ---
def bootstrap_schema(driver):
    with driver.session() as session:
        # Constraints (already created by user, but safe to re-run)
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (p:{NODE_LABELS['person']}) REQUIRE p.email IS UNIQUE")
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (m:{NODE_LABELS['meeting']}) REQUIRE m.id IS UNIQUE")
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (e:{NODE_LABELS['email']}) REQUIRE e.message_id IS UNIQUE")
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (t:{NODE_LABELS['task']}) REQUIRE t.id IS UNIQUE")
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (pr:{NODE_LABELS.get('project', 'Project')}) REQUIRE pr.id IS UNIQUE")
        session.run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (mn:{NODE_LABELS.get('meeting_note', 'MeetingNote')}) REQUIRE mn.id IS UNIQUE")

        # Vector indexes (if embeddings enabled)
        if EMBEDDINGS_PROVIDER != 'none':
            stmts = [
                """
                CREATE VECTOR INDEX IF NOT EXISTS
                FOR (e:Email) ON (e.vec)
                OPTIONS { indexConfig: { `vector.dimensions`: $dim, `vector.similarity_function`: 'cosine' } };
                """,
                """
                CREATE VECTOR INDEX IF NOT EXISTS
                FOR (m:Meeting) ON (m.vec)
                OPTIONS { indexConfig: { `vector.dimensions`: $dim, `vector.similarity_function`: 'cosine' } };
                """,
                """
                CREATE VECTOR INDEX IF NOT EXISTS
                FOR (t:Task) ON (t.vec)
                OPTIONS { indexConfig: { `vector.dimensions`: $dim, `vector.similarity_function`: 'cosine' } };
                """,
            ]
            for cypher in stmts:
                session.run(cypher, dim=EMBEDDINGS_DIM)
    print("[INFO] Neo4j schema bootstrapped.")

# --- Postgres Fetchers ---
def fetch_persons(pg_conn, since, batch_size):
    # Persons are derived from email fields in emails table
    url = f"{SUPABASE_URL}/rest/v1/emails"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json"
    }
    params = {"select": "from_email,to_email,cc", "limit": batch_size}
    if since:
        params["timestamp"] = f"gte.{since}"
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    rows = resp.json()
    emails = set()
    for r in rows:
        if r.get('from_email'): emails.add(_norm_email(r['from_email']))
        for to in (r.get('to_email') or []): emails.add(_norm_email(to))
        for cc in (r.get('cc') or []): emails.add(_norm_email(cc))
    return [{'email': e} for e in emails if e]

def fetch_emails(pg_conn, since, batch_size):
    url = f"{SUPABASE_URL}/rest/v1/emails"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json"
    }
    params = {"order": "timestamp.desc", "limit": batch_size}
    if since:
        params["timestamp"] = f"gte.{since}"
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()

def fetch_events(pg_conn, since, batch_size, is_task=False):
    url = f"{SUPABASE_URL}/rest/v1/events"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json"
    }
    params = {
        "select": "id,title,start_time,notes,ai_summary,attendees",
        "is_task": f"eq.{str(is_task).lower()}",
        "order": "start_time.desc",
        "limit": batch_size
    }

    # --- helpers (top-level) ---
    def _to_list(v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return []

    def fetch_events(pg_conn, since, batch_size, is_task=False):
        url = f"{SUPABASE_URL}/rest/v1/events"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Accept": "application/json"
        }
        params = {
            "select": "id,title,start_time,notes,ai_summary,attendees",
            "is_task": f"eq.{str(is_task).lower()}",
            "order": "start_time.desc",
            "limit": batch_size
        }
        if since:
            params["start_time"] = f"gte.{since}"

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list):
                return []
            # normalize attendees to list for relationship creation
            for ev in data:
                ev["attendees"] = _to_list(ev.get("attendees"))
            return data
        except Exception as e:
            print(f"[ERROR] fetch_events failed: {e}")
            return []
    if since:
        params["start_time"] = f"gte.{since}"
    try:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data
        else:
            return []
    except Exception as e:
        print(f"[ERROR] fetch_events failed: {e}")
        return []

def fetch_meeting_notes(pg_conn, since, batch_size):
    url = f"{SUPABASE_URL}/rest/v1/meeting_notes"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json"
    }
    params = {"order": "created_at.desc", "limit": batch_size}
    if since:
        params["created_at"] = f"gte.{since}"
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()

# --- Upsert Functions ---
def upsert_persons(session, persons):
    count = 0
    for p in persons:
        if not p.get('email'): continue
        session.run(f"MERGE (n:{NODE_LABELS['person']} {{email: $email}})", {'email': p['email']})
        count += 1
    print(f"[INFO] Upserted {count} persons.")

def upsert_emails(session, emails):
    def _to_iso(val):
        if val is None: return None
        if isinstance(val, str): return val
        if isinstance(val, datetime): return val.isoformat()
        return str(val)

    rows = []
    for e in emails:
        msg_id = e.get("message_id") or e.get("msg_id")
        if not msg_id:
            continue
        subject = e.get("subject") or ""
        body    = e.get("summary") or e.get("body") or e.get("body_full") or e.get("body_snippet") or ""
        ts      = _to_iso(e.get("timestamp") or e.get("sent_at"))

        rows.append({
            "id": e.get("id"),
            "msg_id": msg_id,
            "sender_email": e.get("from_email") or e.get("sender_email"),
            "recipients": e.get("to_email") or e.get("recipients") or [],
            "subject": subject,
            "body": body,
            "timestamp": ts,
            "is_unread": bool(e.get("is_unread", True)),
            "vec": embed(f"{subject}\n{body}") if USE_EMBEDS else None,
        })

    cypher = f"""
    UNWIND $rows AS r
    MERGE (e:{NODE_LABELS['email']} {{ message_id: coalesce(r.msg_id, 'email-' + toString(r.id)) }})
    SET e.email_id     = r.id,
        e.msg_id       = r.msg_id,
        e.sender_email = r.sender_email,
        e.recipients   = r.recipients,
        e.subject      = r.subject,
        e.body         = r.body,
        e.sent_at      = CASE WHEN r.timestamp IS NULL THEN e.sent_at ELSE datetime(r.timestamp) END,
        e.is_unread    = coalesce(r.is_unread, e.is_unread),
        e.vec          = CASE WHEN $use_vec AND r.vec IS NOT NULL THEN r.vec ELSE e.vec END
    """
    session.run(cypher, rows=rows, use_vec=bool(USE_EMBEDS))
    print(f"[INFO] Upserted {len(rows)} emails.")

def upsert_events(session, events, is_task=False):
    label = NODE_LABELS['task'] if is_task else NODE_LABELS['meeting']
    count = 0
    for ev in events:
        if not ev.get('id'): continue
        vec = embed(f"{ev.get('title','')}\n{ev.get('ai_summary','')}\n{ev.get('notes','')}") if USE_EMBEDS else None
        props = {
            'id': str(ev['id']),
            'title': ev.get('title'),
            'start_time': _to_iso(ev.get('start_time')),
            'notes': ev.get('notes'),
            'ai_summary': ev.get('ai_summary'),
            'vec': vec,
        }
        session.run(f"MERGE (n:{label} {{id: $id}}) SET n += $props", {'id': str(ev['id']), 'props': props})
        count += 1
    print(f"[INFO] Upserted {count} {label}s.")

def upsert_meeting_notes(session, notes):
    count = 0
    for mn in notes:
        if not mn.get('id'): continue
        props = {
            'id': str(mn['id']),
            'meeting_id': str(mn.get('meeting_id')) if mn.get('meeting_id') else None,
            'summary': mn.get('summary'),
            'notes': mn.get('notes'),
            'created_at': _to_iso(mn.get('created_at')),
        }
        session.run("MERGE (n:MeetingNote {id: $id}) SET n += $props", {'id': str(mn['id']), 'props': props})
        count += 1
    print(f"[INFO] Upserted {count} meeting notes.")

# --- Relationship Upserts ---
def upsert_relationships(session, emails, events):
    # Email SENT/TO relationships
    for e in emails:
        if not e.get('message_id') or not e.get('from_email'): continue
        session.run(
            f"MATCH (p:{NODE_LABELS['person']} {{email: $from_email}}), (e:{NODE_LABELS['email']} {{message_id: $message_id}}) "
            f"MERGE (p)-[:{RELATIONSHIP_TYPES['sent']}]->(e)",
            {'from_email': _norm_email(e['from_email']), 'message_id': e['message_id']}
        )
        for to in e.get('to_email', []):
            if to:
                session.run(
                    f"MATCH (p:{NODE_LABELS['person']} {{email: $to}}), (e:{NODE_LABELS['email']} {{message_id: $message_id}}) "
                    f"MERGE (e)-[:{RELATIONSHIP_TYPES['to']}]->(p)",
                    {'to': _norm_email(to), 'message_id': e['message_id']}
                )
    # Meeting ATTENDED relationships
    for ev in events:
        attendees = ev.get('attendees') or []
        if not ev.get('id') or not attendees: continue
        for att in attendees:
            if att:
                session.run(
                    f"MATCH (p:{NODE_LABELS['person']} {{email: $att}}), (m:{NODE_LABELS['meeting']} {{id: $id}}) "
                    f"MERGE (p)-[:{RELATIONSHIP_TYPES['attended']}]->(m)",
                    {'att': _norm_email(att), 'id': str(ev['id'])}
                )

# --- Main Orchestration ---
def main():
    parser = argparse.ArgumentParser(description="Neo4j Loader for Remi Operational Data")
    parser.add_argument('--full', action='store_true', help='Full mirror (default)')
    parser.add_argument('--since', type=str, help='Incremental load since ISO_DATETIME')
    parser.add_argument('--batch-size', type=int, default=500, help='Batch size')
    parser.add_argument('--skip-embeddings', action='store_true', help='Skip embedding calls')
    args = parser.parse_args()

    since = args.since
    batch_size = args.batch_size
    if args.skip_embeddings:
        global USE_EMBEDS
        USE_EMBEDS = False

    # Connect to Neo4j
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))

    bootstrap_schema(driver)

    with driver.session() as session:
        persons = fetch_persons(None, since, batch_size)
        upsert_persons(session, persons)
        emails = fetch_emails(None, since, batch_size)
        tasks  = fetch_events(None, since, batch_size, is_task=True)
        meets  = fetch_events(None, since, batch_size, is_task=False)

        upsert_emails(session, emails)
        upsert_events(session, tasks, is_task=True)
        upsert_events(session, meets, is_task=False)
        upsert_meeting_notes(session, fetch_meeting_notes(None, since, batch_size))
        upsert_relationships(session, emails, meets)

    return

if __name__ == "__main__":
    main()
