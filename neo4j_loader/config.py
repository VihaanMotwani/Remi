"""
Configuration and mapping for Neo4j loader.
Reads environment variables and provides mapping defaults.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASS = os.getenv("NEO4J_PASS")
EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "none")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
EMBEDDINGS_DIM = int(os.getenv("EMBEDDINGS_DIM", "1536"))

# Validation
missing = [k for k, v in {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
    "NEO4J_URI": NEO4J_URI,
    "NEO4J_USER": NEO4J_USER,
    "NEO4J_PASS": NEO4J_PASS,
}.items() if not v]
if missing:
    print(f"[WARN] Missing required env vars: {', '.join(missing)}")

print(f"[Neo4j Loader Config] Postgres: {SUPABASE_URL and 'set' or 'missing'} | Neo4j: {NEO4J_URI and 'set' or 'missing'} | Embeddings: {EMBEDDINGS_PROVIDER} ({EMBEDDINGS_MODEL}, dim={EMBEDDINGS_DIM})")

# Mapping defaults (can be extended)
NODE_LABELS = {
    "person": "Person",
    "meeting": "Meeting",
    "email": "Email",
    "task": "Task",
    "topic": "Topic",
}

RELATIONSHIP_TYPES = {
    "attended": "ATTENDED",
    "sent": "SENT",
    "to": "TO",
    "derived_from": "DERIVED_FROM",
    "assigned": "ASSIGNED",
    "mentions": "MENTIONS",
}
