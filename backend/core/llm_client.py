import os
import json
import re
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")

def _clean_json(text: str):
    """
    Attempts to fix common JSON issues like trailing commas.
    Returns parsed JSON or raises json.JSONDecodeError.
    """
    # Remove trailing commas before } or ]
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return json.loads(text)


def summarize_text_from_email(text: str, style="concise"):
    prompt = f"""
You are an AI system that summarizes workplace emails into a structured JSON object.

Follow these rules *exactly*:
- Output must be **valid JSON** only — no markdown, no code fences, no explanations, no trailing commas.
- Do not include any keys or fields other than those specified.
- Ensure all string values are enclosed in double quotes.
- Do not include null, undefined, or extra fields.
- If any value cannot be determined, use an empty string "" (not null).
- If there are no action items, use "action_items": [].
- "sentiment" must be exactly one of: "neutral", "urgent", "positive", or "negative".
- "category" must be exactly one of: "Administrative", "Informational", "External Communication", "Project Update", or "Other".

Return the result strictly in the following JSON schema:

{{
  "summary": "concise overview of the email content",
  "action_items": ["action 1", "action 2"],
  "sentiment": "neutral" | "urgent" | "positive" | "negative",
  "category": "Administrative" | "Informational" | "External Communication" | "Project Update" | "Other",
  "response": "possible short and polite response for the email"
}}

Now, read the following email text and return only the JSON:

Email text:
\"\"\"{text}\"\"\"
"""

    try:
        result = model.generate_content(prompt, generation_config={"temperature": 0.5})
        text_output = result.text.strip()

        try:
            parsed = _clean_json(text_output)
        except json.JSONDecodeError:
            print("⚠️ Could not parse Gemini output as JSON, raw text:\n", text_output)
            # Fallback with empty fields
            parsed = {
                "summary": "",
                "action_items": [],
                "sentiment": "neutral",
                "category": "Informational",
                "response": ""
            }
        else:
            # Validate sentiment and category values strictly:
            if parsed.get("sentiment") not in {"neutral", "urgent", "positive", "negative"}:
                parsed["sentiment"] = "neutral"
            if parsed.get("category") not in {
                "Administrative",
                "Informational",
                "External Communication",
                "Project Update",
                "Other",
            }:
                parsed["category"] = "Informational"

            # Ensure action_items is always a list
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


def summarize_text_from_calender(text: str, style="concise"):
    prompt = f"""
    You are an AI assistant that extracts actionable tasks from calendar event text.

    Extract tasks, owners, and due dates (if mentioned) from the following calendar entries.
    Respond **only** with a valid JSON array — no explanations, markdown, or code fences.

    Each object must use this format:
    [
    {{
        "task": "string — concise actionable item",
        "owner": "string — optional, person responsible",
        "due_date": "string — optional, in ISO date format if present"
    }}
    ]

    If no actionable tasks exist, return an empty array: []

    Calendar text:
    \"\"\"{text}\"\"\"
    """
    try:
        result = model.generate_content(prompt, generation_config={"temperature": 0.5})
        text_output = result.text.strip()
        return json.loads(text_output)
    except Exception as e:
        print(f"⚠️ Gemini meeting summary error: {e}")
        return []
def summarize_text_from_meeting(text: str, style="concise"):
    """
    Extract actionable tasks from meeting transcripts.
    Returns a list of task dictionaries with task, owner, and due_date.
    """
    prompt = f"""
You are an AI assistant that extracts actionable tasks from meeting transcripts.

From the text below, identify clear, actionable items and return them as a **JSON array**.
Respond only with valid JSON — no markdown or code fences.

Each task object must have:
[
  {{
    "task": "short, specific, actionable description",
    "owner": "name or role responsible (optional, use null if unknown)",
    "due_date": "ISO 8601 date if mentioned, otherwise null"
  }}
]

If there are no tasks, return an empty array: [].

Meeting transcript:
\"\"\"{text}\"\"\"
"""

    try:
        # Call Gemini
        result = model.generate_content(prompt, generation_config={"temperature": 0.5})
        text_output = result.text.strip()

        # 🧹 Clean markdown formatting if Gemini wraps output in code fences
        text_output = text_output.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(text_output)
        except json.JSONDecodeError:
            print("⚠️ Could not parse Gemini meeting output as JSON. Raw text:\n", text_output)
            parsed = []

        return parsed

    except Exception as e:
        print(f"⚠️ Gemini meeting summary error: {e}")
        return []

def generate_morning_briefing(context: dict, style="friendly"):
    """
    Generate a structured, readable morning report combining emails, meetings, and tasks.
    """
    prompt = f"""
You are an AI workplace assistant that generates a **morning briefing report** for a user.

You’ll be given structured context from multiple sources — emails, calendar events, and past meeting notes.

Use this context to create a clean, easy-to-read daily report that helps the user start their day with clarity.

💡 The report should:
- Start with a short and concise friendly greeting and daily motivation.
- Clearly separate **Urgent Tasks**, **Follow-Ups / Pending Actions**, and **Meetings Today** and have them written in bullet points so it is easily readable.
- Mention key people, projects, and priorities.
- Conclude with a short reminder or focus tip.

Respond only with valid JSON — no markdown or code fences.

Output format:
{{
  "greeting": "short motivational start to the day",
  "urgent_tasks": [
    {{"task": "string", "owner": "string or null", "due_date": "string or null", "source": "email/meeting/calendar"}}
  ],
  "follow_up_tasks": [
    {{"task": "string", "context": "short reason why this matters"}}
  ],
  "meetings_today": [
    {{"title": "string", "time": "HH:MM", "attendees": ["names"], "location": "string", "priority": "High/Medium/Low"}}
  ],
  "summary_text": "concise daily summary paragraph"
}}

Here’s the full context for today:
{json.dumps(context, indent=2)}
"""

    result = model.generate_content(prompt, generation_config={"temperature": 0.4})
    text_output = result.text.strip().replace("```json", "").replace("```", "")

    try:
        return json.loads(text_output)
    except json.JSONDecodeError:
        print("⚠️ Could not parse Gemini morning report as JSON. Raw output:\n", text_output)
        return {
            "greeting": "Good morning! Ready to start your day.",
            "urgent_tasks": [],
            "follow_up_tasks": [],
            "meetings_today": [],
            "summary_text": "Unable to generate detailed report.",
        }
