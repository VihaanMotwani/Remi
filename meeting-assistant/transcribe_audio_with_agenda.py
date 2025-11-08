#!/usr/bin/env python3
"""
Real-time audio transcription with Agenda Tracking
Extends transcribe_audio.py to send transcriptions to agenda tracker via WebSocket
"""

import sys
import os
import numpy as np
import warnings
from datetime import datetime
from openai import OpenAI
import io
import wave
import asyncio
import websockets
import json

# Suppress warnings
warnings.filterwarnings("ignore")

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Get stream type from command line argument
STREAM_TYPE = sys.argv[1] if len(sys.argv) > 1 else "mic"
STREAM_ICON = "🎤" if STREAM_TYPE == "mic" else "🔊"
STREAM_LABEL = "You" if STREAM_TYPE == "mic" else "Other"

# WebSocket connection to agenda tracker
AGENDA_TRACKER_URL = "ws://localhost:8765"
ws_connection = None

# For process identification
PROCESS_ID = f"{STREAM_TYPE}_{os.getpid()}"


def log_message(message, include_label=False):
    """Print timestamped log message with optional stream label"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    if include_label:
        print(f"[{timestamp}] {STREAM_ICON} {STREAM_LABEL}: {message}", flush=True)
    else:
        print(f"[{timestamp}] {message}", flush=True)


async def send_to_agenda_tracker(speaker: str, text: str):
    """Send transcription to agenda tracker via WebSocket"""
    global ws_connection
    
    try:
        # Check if we need to create/recreate connection
        if ws_connection is None:
            ws_connection = await websockets.connect(AGENDA_TRACKER_URL)
            log_message("🔌 Connected to agenda tracker")
        
        message = json.dumps({
            "type": "transcription",
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        
        await ws_connection.send(message)
    except (websockets.exceptions.ConnectionClosed, AttributeError) as e:
        # Connection was closed, reconnect and retry
        try:
            ws_connection = await websockets.connect(AGENDA_TRACKER_URL)
            log_message("🔌 Reconnected to agenda tracker")
            await ws_connection.send(message)
        except Exception as retry_error:
            log_message(f"⚠️ Could not send to agenda tracker: {retry_error}")
            ws_connection = None
    except Exception as e:
        log_message(f"⚠️ Could not send to agenda tracker: {e}")
        ws_connection = None


def reduce_noise(audio_array):
    """Simple noise reduction using spectral gating"""
    noise_sample_size = min(8000, len(audio_array) // 4)
    noise_floor = np.mean(np.abs(audio_array[:noise_sample_size]))
    threshold = noise_floor * 2.0
    mask = np.abs(audio_array) > threshold
    audio_array = audio_array * mask
    return audio_array


def detect_silence(audio_array, threshold=0.01):
    """Check if audio chunk is mostly silence"""
    rms = np.sqrt(np.mean(audio_array ** 2))
    return rms < threshold


def is_repetitive(text, max_repetition=8):
    """Detect if text has excessive repetition (hallucination indicator)"""
    if not text:
        return False
    
    words = text.split()
    if len(words) < 10:
        return False
    
    consecutive_count = 1
    for i in range(1, len(words)):
        if words[i] == words[i-1]:
            consecutive_count += 1
            if consecutive_count >= 5:
                return True
        else:
            consecutive_count = 1
    
    for phrase_len in range(3, 7):
        phrases = [' '.join(words[i:i+phrase_len]) for i in range(len(words) - phrase_len + 1)]
        from collections import Counter
        phrase_counts = Counter(phrases)
        if any(count > max_repetition for count in phrase_counts.values()):
            return True
    
    return False


def audio_to_wav_bytes(audio_array, sample_rate=16000):
    """Convert numpy audio array to WAV format bytes"""
    audio_int16 = (audio_array * 32767).astype(np.int16)
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    wav_io.seek(0)
    return wav_io


async def process_audio_async():
    """Main async processing loop"""
    log_message(f"🎙️ Initializing OpenAI Whisper API ({STREAM_TYPE} stream)...")
    
    if not os.environ.get("OPENAI_API_KEY"):
        log_message("❌ OPENAI_API_KEY environment variable not set!")
        sys.exit(1)
    
    log_message(f"✅ OpenAI API ready for {STREAM_TYPE} audio")
    log_message(f"{STREAM_ICON} Ready to transcribe {STREAM_LABEL}'s audio...")
    log_message("🎯 Will send transcriptions to agenda tracker...")
    log_message("")
    
    audio_buffer = []
    chunk_duration = 8.0
    sample_rate = 16000
    samples_per_chunk = int(sample_rate * chunk_duration)
    
    try:
        while True:
            line = sys.stdin.readline()
            
            if not line:
                log_message(f"⚠️ Stdin closed for {PROCESS_ID}, exiting...")
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                samples = [float(x) for x in line.split(',') if x]
                audio_buffer.extend(samples)
                
                if len(audio_buffer) >= samples_per_chunk:
                    audio_array = np.array(audio_buffer[:samples_per_chunk], dtype=np.float32)
                    
                    if detect_silence(audio_array, threshold=0.008):
                        audio_buffer = audio_buffer[samples_per_chunk:]
                        continue
                    
                    audio_array = reduce_noise(audio_array)
                    
                    if np.max(np.abs(audio_array)) > 0:
                        audio_array = audio_array / np.max(np.abs(audio_array))
                    
                    wav_bytes = audio_to_wav_bytes(audio_array, sample_rate)
                    wav_bytes.name = "audio.wav"
                    
                    try:
                        transcription = client.audio.transcriptions.create(
                            model="whisper-1",
                            file=wav_bytes,
                            language="en",
                            temperature=0.2
                        )
                        
                        text = transcription.text.strip()
                        
                        if text and not text.startswith("This is a meeting"):
                            if is_repetitive(text):
                                log_message(f"⚠️ Skipped repetitive hallucination")
                            else:
                                log_message(text, include_label=True)
                                # Send to agenda tracker
                                await send_to_agenda_tracker(STREAM_LABEL, text)
                    
                    except Exception as api_error:
                        log_message(f"❌ API Error: {api_error}")
                    
                    audio_buffer = audio_buffer[samples_per_chunk:]
                    
            except Exception as e:
                log_message(f"❌ Error processing audio: {e}")
                continue
                
    except KeyboardInterrupt:
        log_message(f"🛑 Transcription stopped ({PROCESS_ID})")
    except Exception as e:
        log_message(f"❌ Fatal error in {PROCESS_ID}: {e}")
        import traceback
        log_message(traceback.format_exc())
    finally:
        log_message(f"🔌 Closing WebSocket for {PROCESS_ID}")
        if ws_connection:
            try:
                await ws_connection.close()
            except:
                pass


def main():
    """Entry point - run async event loop"""
    try:
        log_message(f"🚀 Starting transcription process: {PROCESS_ID}")
        asyncio.run(process_audio_async())
    except Exception as e:
        log_message(f"💥 CRASH in {PROCESS_ID}: {e}")
        import traceback
        log_message(traceback.format_exc())
        raise


if __name__ == "__main__":
    main()
