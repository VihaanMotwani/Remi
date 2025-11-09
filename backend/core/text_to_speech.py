from elevenlabs import ElevenLabs
from dotenv import load_dotenv
import pygame, tempfile, os

load_dotenv()
tts_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

def speak_text(text: str):
    """Convert text to speech (MP3) and play it using pygame."""
    audio_bytes = b"".join(
        tts_client.text_to_speech.convert(
            text=text,
            voice_id="MClEFoImJXBTgLwdLI5n",  # or another ElevenLabs voice ID
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            voice_settings={
                "style": 0.6,            # adds warmth & emotion
            },
        )
    )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    pygame.mixer.init()
    pygame.mixer.music.load(tmp_path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)
