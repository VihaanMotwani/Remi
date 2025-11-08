import speech_recognition as sr
import re, time, json, os
from agents.daily_agent import compile_daily_context
from core.llm_client import generate_daily_voice_summary

def listen_and_route():
    """
    🎧 Remi voice interface (streaming edition)
    - Listens once for a command
    - Determines the focus (tasks, calendar, or day)
    - Streams Gemini + ElevenLabs response live
    """
    r = sr.Recognizer()
    mic = sr.Microphone()

    print("🎙 Remi is listening… say something like 'what are my tasks for today' or 'what does my day look like'.")
    with mic as source:
        print("🎧 Calibrating ambient noise... (1.5s)")
        r.adjust_for_ambient_noise(source, duration=1.5)
        print("🎤 Listening for your voice...")

        try:
            audio = r.listen(source, timeout=8, phrase_time_limit=8)
        except sr.WaitTimeoutError:
            print("⌛ Timeout — no speech detected. Exiting.")
            return

        try:
            text = r.recognize_google(audio).lower()
            print(f"Heard: {text}")

            # --- Determine focus intent ---
            if "task" in text:
                focus = "tasks"
            elif "calendar" in text or "meeting" in text or "schedule" in text:
                focus = "calendar"
            else:
                focus = "day"

            print(f"🧠 Command detected: {text}")
            print(f"🎯 Focus area: {focus}")

            # --- Compile context from database ---
            context = compile_daily_context()

            # --- Stream Gemini + ElevenLabs live ---
            print("🗣️ Generating and speaking response in real time...")
            summary_text = generate_daily_voice_summary(context, focus)

            print("\n🏁 Done — Remi has finished responding. Exiting.")

        except sr.UnknownValueError:
            print("❌ Could not understand speech.")
        except Exception as e:
            print(f"❌ Voice agent error: {e}")
