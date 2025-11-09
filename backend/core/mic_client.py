import speech_recognition as sr
import time
import asyncio
import json
import websockets
from core.text_to_speech import speak_text
from dotenv import load_dotenv
load_dotenv()

# 🧠 Connect to Electron's WebSocket (running on localhost:5050)
async def send_state(state: str):
    """Send agent state ('idle', 'listening', 'speaking') to Electron WebSocket."""
    try:
        async with websockets.connect("ws://localhost:5050") as ws:
            await ws.send(json.dumps({"state": state}))
    except Exception as e:
        print(f"⚠️ Could not send state '{state}': {e}")


async def listen_and_route():
    """🎧 Remi Voice Assistant — conversational edition (async version)."""
        # ✅ Lazy imports (avoid circular dependency)
    from agents.daily_agent import compile_daily_context
    from core.llm_client import generate_daily_voice_summary

    r = sr.Recognizer()
    mic = sr.Microphone()

    r = sr.Recognizer()
    mic = sr.Microphone()

    await send_state("idle")  # initial

    # 🌅 Greeting
    greeting = (
        "Good morning, Tanya! Let's get your day started. "
        "Would you like a quick overview, or should I walk you through your tasks first?"
    )
    print(f"🤖 Remi: {greeting}")
    await send_state("speaking")
    speak_text(greeting)

    MAX_ATTEMPTS = 3
    attempt = 0
    user_text = None

    while attempt < MAX_ATTEMPTS and not user_text:
        await send_state("listening")
        with mic as source:
            print("\n🎧 Calibrating ambient noise... (1.5s)")
            r.adjust_for_ambient_noise(source, duration=1.5)
            print("🎤 Listening for your response...")
            try:
                audio = r.listen(source, timeout=10, phrase_time_limit=15)
                user_text = r.recognize_google(audio).lower()
                print(f"Heard: {user_text}")

            except sr.WaitTimeoutError:
                print("⌛ Timeout — no speech detected.")
            except sr.UnknownValueError:
                print("❌ Could not understand speech.")
            except Exception as e:
                print(f"⚠️ Error while listening: {e}")

        if not user_text:
            attempt += 1
            if attempt < MAX_ATTEMPTS:
                retry_prompt = (
                    "Hey, I didn’t quite catch that. Could you repeat what you’d like — "
                    "an overview or your tasks for today?"
                )
                await send_state("speaking")
                print(f"🤖 Remi: {retry_prompt}")
                speak_text(retry_prompt)
                time.sleep(1)
            else:
                await send_state("idle")
                print("❌ No response received after retries. Exiting.")
                speak_text("No worries, Tanya. I’ll check in later when you’re ready.")
                return

    # 🧠 Determine focus intent
    text = user_text
    if "task" in text:
        focus = "tasks"
    elif "calendar" in text or "meeting" in text or "schedule" in text:
        focus = "calendar"
    else:
        focus = "day"

    print(f"🧠 Command detected: {text}")
    print(f"🎯 Focus area: {focus}")

    # 🗣️ Generate and speak response
    await send_state("speaking")
    context = compile_daily_context()
    print("🗣️ Generating and speaking response in real time...")
    summary_text = generate_daily_voice_summary(context, focus)

    # ✅ Wrap up
    closing_message = "All caught up, Tanya. You’re ready to take on the day!"
    speak_text(closing_message)
    await send_state("idle")

    print("🏁 Done — Remi has finished responding.")
