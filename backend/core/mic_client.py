import speech_recognition as sr
import time
import asyncio
from agents.daily_agent import compile_daily_context
from core.llm_client import generate_daily_voice_summary
from core.text_to_speech import speak_text  
from core.server import broadcast_state  
from dotenv import load_dotenv
load_dotenv()


def listen_and_route():
    """
    🎧 Remi Voice Assistant — conversational edition (with live state updates)
    """

    r = sr.Recognizer()
    mic = sr.Microphone()

    # 🌅 Greeting
    greeting = (
        "Good morning, Tanya! Let's get your day started. "
        "Would you like a quick overview, or should I walk you through your tasks first?"
    )
    print(f"🤖 Remi: {greeting}")
    asyncio.run(broadcast_state("speaking"))
    speak_text(greeting)

    MAX_ATTEMPTS = 3
    attempt = 0
    user_text = None

    while attempt < MAX_ATTEMPTS and not user_text:
        asyncio.run(broadcast_state("listening"))
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
                asyncio.run(broadcast_state("speaking"))
                print(f"🤖 Remi: {retry_prompt}")
                speak_text(retry_prompt)
                time.sleep(1)
            else:
                asyncio.run(broadcast_state("idle"))
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

    # 🧠 Generate response
    asyncio.run(broadcast_state("speaking"))
    context = compile_daily_context()
    print("🗣️ Generating and speaking response in real time...")
    summary_text = generate_daily_voice_summary(context, focus)

    # ✅ Wrap up
    closing_message = "All caught up, Tanya. You’re ready to take on the day!"
    print("\n🏁 Done — Remi has finished responding.")
    speak_text(closing_message)
    asyncio.run(broadcast_state("idle"))
