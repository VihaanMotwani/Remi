import os
import json
import re
import time
import google.generativeai as genai

# ================================
# 🔧 CONFIG
# ================================
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")


# ================================
# 🧠 HELPER FUNCTIONS
# ================================
def _clean_json(text: str):
    """Attempts to fix common JSON issues like trailing commas and code fences."""
    # Strip markdown fences
    text = text.strip().replace("```json", "").replace("```", "")
    # Remove trailing commas before } or ]
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return json.loads(text)


def safe_generate_content(prompt, retries=3, temperature=0.4):
    """
    Wrapper for model.generate_content() with automatic rate-limit retry.
    Retries on 429 or transient errors with exponential backoff.
    """
    for attempt in range(retries):
        try:
            return model.generate_content(prompt, generation_config={"temperature": temperature})
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                wait_time = 8 * (attempt + 1)
                print(f"⚠️ Gemini rate limit hit. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise
    raise RuntimeError("❌ Gemini failed after multiple retries.")


# ================================
# 📧 EMAIL SUMMARIZATION
# ================================
def summarize_text_from_email(text: str, style="concise"):
    prompt = f"""
You are an AI system that summarizes workplace emails into a structured JSON object.

Follow these rules *exactly*:
- Output must be **valid JSON** only — no markdown, no code fences, no explanations.
- Ensure all string values are enclosed in double quotes.
- If any value cannot be determined, use an empty string "" (not null).
- If there are no action items, use "action_items": [].
- "sentiment" must be exactly one of: "neutral", "positive", or "negative".
- "category" must be one of: "Administrative", "Informational", "External Communication", "Project Update", "Other".

Return strictly this JSON:
{{
  "summary": "concise overview of the email content",
  "action_items": ["action 1", "action 2"],
  "sentiment": "neutral" | "positive" | "negative",
  "category": "Administrative" | "Informational" | "External Communication" | "Project Update" | "Other",
  "response": "short polite response"
}}

Email text:
\"\"\"{text}\"\"\"
"""

    try:
        result = safe_generate_content(prompt, temperature=0.5)
        text_output = result.text.strip().replace("```json", "").replace("```", "")

        try:
            parsed = _clean_json(text_output)
        except json.JSONDecodeError:
            print("⚠️ Could not parse Gemini output as JSON, raw text:\n", text_output)
            parsed = {
                "summary": "",
                "action_items": [],
                "sentiment": "neutral",
                "category": "Informational",
                "response": ""
            }

        # ✅ Enforce schema safety
        sentiment = parsed.get("sentiment", "").lower()
        if sentiment not in {"neutral", "positive", "negative"}:
            parsed["sentiment"] = "neutral"

        if parsed.get("category") not in {
            "Administrative",
            "Informational",
            "External Communication",
            "Project Update",
            "Other",
        }:
            parsed["category"] = "Informational"

        if not isinstance(parsed.get("action_items"), list):
            parsed["action_items"] = []

        print("Gemini parsed email summary:", parsed)
        return parsed

    except Exception as e:
        print(f"⚠️ Gemini email summary error: {e}")
        return {
            "summary": "",
            "action_items": [],
            "sentiment": "neutral",
            "category": "Informational",
            "response": ""
        }


# ================================
# 📅 CALENDAR SUMMARIZATION
# ================================
def summarize_text_from_calender(text: str, style="concise"):
    prompt = f"""
You are an AI assistant that extracts actionable tasks from calendar event text.

Respond only with a **valid JSON array** (no markdown, no code fences).
Each element must be:
[
  {{
    "task": "short actionable item",
    "owner": "string or empty",
    "due_date": "ISO 8601 date or empty"
    "attendees": ["string", "array of names attending the event"] or [],
  }}
]
If no actionable tasks exist, return [].

Calendar text:
\"\"\"{text}\"\"\"
"""
    try:
        result = safe_generate_content(prompt, temperature=0.5)
        text_output = result.text.strip().replace("```json", "").replace("```", "")
        return json.loads(text_output)
    except Exception as e:
        print(f"⚠️ Gemini calendar summary error: {e}")
        return []


# ================================
# 💬 MEETING SUMMARIZATION
# ================================
def summarize_text_from_meeting(text: str, style="concise"):
    prompt = f"""
You are an AI assistant that extracts actionable tasks from meeting transcripts.
Return only a JSON array as follows:
[
  {{
    "task": "short, actionable description",
    "owner": "string or empty",
    "due_date": "ISO 8601 date or empty"
  }}
]
If there are no tasks, return [].

Transcript:
\"\"\"{text}\"\"\"
"""
    try:
        result = safe_generate_content(prompt, temperature=0.5)
        text_output = result.text.strip().replace("```json", "").replace("```", "")
        return json.loads(text_output)
    except Exception as e:
        print(f"⚠️ Gemini meeting summary error: {e}")
        return []


# ================================
# 🌅 DAILY MORNING BRIEFING
# ================================
def generate_morning_briefing(context: dict, style="friendly"):
    prompt = f"""
You are an AI workplace assistant that generates a **morning briefing report** for a user.

Generate clean JSON with the following keys:
{{
  "greeting": "...",
  "urgent_tasks": [{{"task": "...", "owner": "...", "due_date": "...", "source": "email/meeting/calendar"}}],
  "follow_up_tasks": [{{"task": "...", "context": "..."}}],
  "meetings_today": [{{"title": "...", "time": "...", "attendees": ["..."], "location": "...", "priority": "High/Medium/Low"}}],
  "summary_text": "..."
}}

Here’s the context:
{json.dumps(context, indent=2)}
"""
    try:
        result = safe_generate_content(prompt, temperature=0.4)
        text_output = result.text.strip().replace("```json", "").replace("```", "")
        return json.loads(text_output)
    except Exception as e:
        print(f"⚠️ Could not parse Gemini morning report as JSON. Raw output:\n{e}")
        return {
            "greeting": "Good morning! Ready to start your day.",
            "urgent_tasks": [],
            "follow_up_tasks": [],
            "meetings_today": [],
            "summary_text": "Unable to generate detailed report.",
        }


# ================================
# 💌 EMAIL REPLY SUGGESTION
# ================================
def suggest_email_reply(email_text: str, style="friendly"):
    prompt = f"""
You are an AI assistant that drafts professional email replies.

Return JSON only:
{{
  "reply": "string",
  "tone": "{style}",
  "confidence": 0.0-1.0
}}

Email:
\"\"\"{email_text}\"\"\"
"""
    try:
        result = safe_generate_content(prompt, temperature=0.4)
        output = result.text.strip().replace("```json", "").replace("```", "")
        return json.loads(output)
    except Exception as e:
        print(f"⚠️ Error generating suggested reply: {e}")
        return {
            "reply": "(No suggestion available)",
            "tone": style,
            "confidence": 0.0
        }


# ================================
# 🔊 VOICE SUMMARY (for mic agent)
# ================================
def generate_daily_voice_summary(context: dict, focus: str = "day"):
    """
    🔊 Stream a natural spoken summary for the day, tasks, or calendar.
    Uses Gemini streaming for near-real-time generation and ElevenLabs streaming for voice playback.
    """
    import google.generativeai as genai
    from elevenlabs import ElevenLabs, stream, VoiceSettings
    from dotenv import load_dotenv
    import os

    load_dotenv()
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-2.5-flash")
    tts_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    # --- Prompt style depending on user intent ---
    prompt_templates = {
        "day": (
            "You are Remi, a warm and conversational AI assistant.\n"
            "Describe the user's overall day naturally — mention meetings, key tasks, and tone.\n"
            "Keep it around 4 sentences, friendly and human (no bullet points).\n\n"
            "Context:\n{json_context}"
        ),
        "tasks": (
            "You are Remi, a friendly assistant.\n"
            "Summarize today's tasks and follow-ups conversationally, as if explaining to the user in real life.\n"
            "Avoid lists and bullets — make it flow naturally in speech.\n\n"
            "Context:\n{json_context}"
        ),
        "calendar": (
            "You are Remi, a professional voice assistant.\n"
            "Talk through today's calendar — what’s coming up, who’s involved, and any prep needed.\n"
            "Keep it smooth and natural, not list-like.\n\n"
            "Context:\n{json_context}"
        ),
    }

    prompt = prompt_templates.get(focus, prompt_templates["day"]).format(
        json_context=json.dumps(context, indent=2)
    )

    print(f"🧠 Starting Gemini stream for focus: {focus}")
    full_text = ""

    # Start ElevenLabs stream for near-instant speech
    for chunk in model.generate_content(prompt, stream=True):
        if chunk.text:
            print(chunk.text, end="", flush=True)
            full_text += chunk.text

            # Stream each chunk immediately to ElevenLabs
            with tts_client.text_to_speech.stream(
                text=chunk.text,  # ✅ explicit argument required
                voice_id="JBFqnCBsd6RMkjVDRZzb",
                model_id="eleven_turbo_v2",
                voice_settings=VoiceSettings(
                    stability=0.4, similarity_boost=0.8, style=0.6, speed=1.1
                ),
            ) as stream_audio:
                for event in stream_audio:
                    if event.type == "error":
                        print(f"⚠️ ElevenLabs stream error: {event.error}")

    print("\n✅ Voice summary finished streaming.")
    return full_text
