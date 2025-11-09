# neo4j_loader/ai_linker.py
import os, time, json
from typing import List, Dict, Any, Iterable, Tuple
from openai import OpenAI

ALLOW_RELS = {
    ("Email","FOLLOW_UP_OF","Email"),
    ("Task","DERIVED_FROM","Email"),
    ("Task","DERIVED_FROM","Meeting"),
    ("Meeting","CONTINUES","Meeting"),
    ("Project","MENTIONS","Topic"),
    ("Email","BLOCKED_BY","Task"),
    ("Meeting","ABOUT","Project"),
    ("Email","ABOUT","Project"),
    ("Task","ABOUT","Project"),
    ("MeetingNote","REFERS_TO","Email"),
    ("MeetingNote","ANNOTATES","Meeting"),
}

def _ok_triplet(src_label, rel_type, dst_label):
    return (src_label, rel_type, dst_label) in ALLOW_RELS

def _has_index(session, name: str) -> bool:
    res = session.run("SHOW INDEXES YIELD name RETURN collect(name) AS names").single()
    names = set(res["names"] or [])
    return name in names

# ---------- Candidate generation (heuristics + vectors) ----------
def gen_candidates(session, topk=5, min_sim=0.82) -> List[Dict[str,Any]]:
    """
    Use existing graph signals to propose edges for LLM judgment.
    Returns list of dicts with (src_label, src_key, dst_label, dst_key, rel, evidence)
    """
    cands: List[Dict[str,Any]] = []

    # 1) Same thread → FOLLOW_UP_OF (Email)
    q1 = """
    MATCH (e:Email) WHERE e.thread_id IS NOT NULL
    WITH e.thread_id AS thr
    MATCH (a:Email {thread_id: thr})-[:REPLY_TO*0..1]->(b:Email {thread_id: thr})
    WHERE a <> b AND a.sent_at > b.sent_at
    WITH a,b ORDER BY a.sent_at ASC
    RETURN a.message_id AS a_id, b.message_id AS b_id LIMIT 500
    """
    for r in session.run(q1):
        cands.append({
            "src_label":"Email", "src_key": r["a_id"],
            "dst_label":"Email", "dst_key": r["b_id"],
            "rel": "FOLLOW_UP_OF",
            "evidence": {"rule":"same_thread_order"}
        })

    # 2) Vector similarity: Email ~ Meeting => ABOUT (weak)
    if _has_index(session, "meet_vec_idx"):
        q2 = """
    MATCH (e:Email) WHERE e.vec IS NOT NULL
    WITH e LIMIT 4000
    CALL db.index.vector.queryNodes('meet_vec_idx', $topk, e.vec)
      YIELD node AS m, score
    WHERE score >= $min_sim
    RETURN e.message_id AS e_id, m.id AS m_id, score
    """
        for r in session.run(q2, topk=topk, min_sim=float(min_sim)):
            cands.append({
                "src_label":"Email","src_key":r["e_id"],
                "dst_label":"Meeting","dst_key":r["m_id"],
                "rel":"ABOUT",
                "evidence":{"rule":"vec_em_meet","score":float(r["score"])}
            })

    # 3) Temporal proximity: Task shortly after Meeting → DERIVED_FROM
    q3 = """
    MATCH (m:Meeting),(t:Task)
    WHERE m.start_time IS NOT NULL AND t.start_time IS NOT NULL
      AND t.start_time >= m.start_time AND t.start_time <= m.start_time + duration('P2D')
    WITH m,t LIMIT 1000
    RETURN m.id AS mid, t.id AS tid
    """
    for r in session.run(q3):
        cands.append({
            "src_label":"Task","src_key":r["tid"],
            "dst_label":"Meeting","dst_key":r["mid"],
            "rel":"DERIVED_FROM",
            "evidence":{"rule":"temporal_within_2d"}
        })

    return cands

# ---------- LLM reasoning ----------
_REASON_SCHEMA = {
  "type": "object",
  "properties": {
    "decision": {"type":"string","enum":["accept","reject","revise"]},
    "rel_type": {"type":"string"},
    "confidence": {"type":"number"},
    "justification": {"type":"string"},
  },
  "required": ["decision","confidence","justification"]
}

PROMPT = """You are a strict graph-relationships judge for a productivity assistant.
Allowed relation types and endpoints are fixed:
- Email FOLLOW_UP_OF Email
- Task DERIVED_FROM Email|Meeting
- Meeting CONTINUES Meeting
- Project MENTIONS Topic
- Email|Meeting|Task ABOUT Project
- MeetingNote REFERS_TO Email
- MeetingNote ANNOTATES Meeting
- Email BLOCKED_BY Task

Given a CANDIDATE edge and small EVIDENCE (vector score, thread id, timestamps)
return JSON with: decision (accept|reject|revise), rel_type (if revising), confidence (0..1),
and a one-sentence justification.

Reject if evidence is weak, wrong labels, or relation isn't in the allowed list.
Be conservative: only accept when evidence is clear."""

def judge_candidates(cands: List[Dict[str,Any]], client: OpenAI) -> List[Dict[str,Any]]:
    out = []
    for c in cands:
        if not _ok_triplet(c["src_label"], c["rel"], c["dst_label"]):
            # let LLM possibly revise rel_type
            rel_hint = c["rel"]
        else:
            rel_hint = None

        msg = [
            {"role":"system","content":PROMPT},
            {"role":"user","content":json.dumps({
                "src_label": c["src_label"], "src_key": c["src_key"],
                "rel_type": c["rel"],
                "dst_label": c["dst_label"], "dst_key": c["dst_key"],
                "evidence": c.get("evidence", {})
            }, ensure_ascii=False)}
        ]
        try:
            resp = client.chat.completions.create(
                model=os.environ.get("OPENAI_MODEL","gpt-4o-mini"),
                response_format={"type":"json_object"},
                messages=msg,
                temperature=0.2,
            )
            decision = json.loads(resp.choices[0].message.content)
        except Exception as e:
            # fail-safe: reject
            decision = {"decision":"reject","confidence":0.0,"justification":f"error {e}"}

        d = {
            "src_label": c["src_label"], "src_key": c["src_key"],
            "dst_label": c["dst_label"], "dst_key": c["dst_key"],
            "rel_type": decision.get("rel_type") or c["rel"],
            "decision": decision.get("decision","reject"),
            "confidence": float(decision.get("confidence",0.0)),
            "justification": decision.get("justification","")
        }
        # only keep accept (or strong revise)
        if d["decision"] == "accept" and _ok_triplet(d["src_label"], d["rel_type"], d["dst_label"]):
            out.append(d)
    return out

# ---------- Persist to Supabase (audit) ----------
def persist_ai_edges(sb_url: str, sb_key: str, rows: List[Dict[str,Any]]):
    import requests
    if not rows: return
    headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}", "Content-Type":"application/json"}
    url = f"{sb_url}/rest/v1/ai_edges"
    # chunked upsert
    for i in range(0, len(rows), 500):
        chunk = rows[i:i+500]
        r = requests.post(url, headers=headers,
                          params={"on_conflict":"src_label,src_key,rel_type,dst_label,dst_key,source"},
                          json=chunk, timeout=60)
        if r.status_code not in (200,201,204):
            print("[WARN] ai_edges upsert failed", r.status_code, r.text)

# ---------- Upsert edges into Neo4j ----------
def upsert_ai_edges(session, rows: List[Dict[str,Any]]):
    if not rows: return
    # split by (src_label, dst_label) for MATCH patterns
    # Emails keyed by message_id; others by id
    email_rows = [r for r in rows if r["src_label"]=="Email" or r["dst_label"]=="Email"]
    other_rows = [r for r in rows if r not in email_rows]

    # Generic handler that switches labels at runtime
    cypher = """
    UNWIND $rows AS r
    CALL {
      WITH r
      CALL {
        WITH r
        WITH r WHERE r.src_label='Email'
        MATCH (s:Email {message_id:r.src_key})
        RETURN s
        UNION
        WITH r WHERE r.src_label='Meeting'
        MATCH (s:Meeting {id:r.src_key})
        RETURN s
        UNION
        WITH r WHERE r.src_label='Task'
        MATCH (s:Task {id:r.src_key})
        RETURN s
        UNION
        WITH r WHERE r.src_label='Project'
        MATCH (s:Project {id:r.src_key})
        RETURN s
        UNION
        WITH r WHERE r.src_label='MeetingNote'
        MATCH (s:MeetingNote {id:r.src_key})
        RETURN s
      }
      CALL {
        WITH r
        WITH r WHERE r.dst_label='Email'
        MATCH (t:Email {message_id:r.dst_key})
        RETURN t
        UNION
        WITH r WHERE r.dst_label='Meeting'
        MATCH (t:Meeting {id:r.dst_key})
        RETURN t
        UNION
        WITH r WHERE r.dst_label='Task'
        MATCH (t:Task {id:r.dst_key})
        RETURN t
        UNION
        WITH r WHERE r.dst_label='Project'
        MATCH (t:Project {id:r.dst_key})
        RETURN t
        UNION
        WITH r WHERE r.dst_label='Topic'
        MERGE (t:Topic {label:r.dst_key})  // create topics on demand
        RETURN t
      }
      WITH s,t,r
      WHERE s IS NOT NULL AND t IS NOT NULL AND s<>t
      CALL apoc.merge.relationship(s, r.rel_type, {}, {}, t, {}) YIELD rel
      SET rel.confidence = r.confidence, rel.justification = r.justification
      RETURN 0
    }
    RETURN 0
    """
    session.run(cypher, rows=rows)

def upsert_ai_edges_no_apoc(session, rows):
    """
    rows: [{src_label, src_key, dst_label, dst_key, rel_type, confidence, justification}]
    Email is keyed by message_id; others by id.
    """
    if not rows:
        return

    # group rows by (src_label, dst_label, rel_type)
    from collections import defaultdict
    buckets = defaultdict(list)
    for r in rows:
        buckets[(r["src_label"], r["dst_label"], r["rel_type"])].append(r)

    def key_field(lbl):
        return "message_id" if lbl == "Email" else "id"

    for (s_lbl, t_lbl, rel), chunk in buckets.items():
        s_key = key_field(s_lbl)
        t_key = key_field(t_lbl)
        cypher = f"""
        UNWIND $rows AS r
        MATCH (s:{s_lbl} {{{s_key}: r.src_key}})
        MATCH (t:{t_lbl} {{{t_key}: r.dst_key}})
        MERGE (s)-[x:`{rel}`]->(t)
        SET   x.confidence   = coalesce(r.confidence, x.confidence),
              x.justification = coalesce(r.justification, x.justification),
              x.source        = coalesce(r.source, 'llm_v1'),
              x.created_at    = coalesce(x.created_at, datetime())
        """
        session.run(cypher, rows=chunk)
