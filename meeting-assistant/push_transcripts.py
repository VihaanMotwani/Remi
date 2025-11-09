#!/usr/bin/env python3
"""
Automate merging mic and system transcripts for each meeting session and insert unified transcript into Supabase.
"""
import os
import json
from pathlib import Path
from datetime import datetime
import sys
from dotenv import load_dotenv
sys.path.append(str(Path(__file__).parent.parent))
load_dotenv()
from backend.core.supabase_client import insert_record

def find_session_files(transcripts_dir):
    """Return list of (mic_file, system_file) tuples for each session."""
    files = list(Path(transcripts_dir).glob("*.ndjson"))
    sessions = {}
    for f in files:
        parts = f.name.split("_")
        if len(parts) < 3:
            continue
        session_key = parts[0]  # timestamp
        stream_type = parts[1]
        sessions.setdefault(session_key, {})[stream_type] = f
    # Only sessions with both mic and system
    return [ (v.get("mic"), v.get("system")) for v in sessions.values() if v.get("mic") and v.get("system") ]

def read_transcript_lines(file):
    if not file or not file.exists():
        return []
    with open(file, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

def merge_transcripts(mic_lines, system_lines):
    all_lines = mic_lines + system_lines
    all_lines.sort(key=lambda x: x["ts"])
    return all_lines

def push_all_sessions(transcripts_dir):
    sessions = find_session_files(transcripts_dir)
    for mic_file, system_file in sessions:
        mic_lines = read_transcript_lines(mic_file)
        system_lines = read_transcript_lines(system_file)
        merged = merge_transcripts(mic_lines, system_lines)
        full_text = "\n".join(f"[{l['speaker']}] {l['text']}" for l in merged)
        created_at = merged[0]["ts"] if merged else datetime.now().isoformat()
        session_id = mic_file.stem.split("_mic_")[0] if mic_file else "unknown"
        record = {
            "transcription": full_text,
            "created_at": created_at,
        }
        print(f"Uploading session {session_id}...")
        insert_record("meeting_notes", record)
        print(f"✅ Uploaded: {session_id}")

if __name__ == "__main__":
    transcripts_dir = Path(__file__).parent / "transcripts"
    push_all_sessions(transcripts_dir)
