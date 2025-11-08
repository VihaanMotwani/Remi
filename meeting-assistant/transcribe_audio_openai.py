#!/usr/bin/env python3
"""
Real-time audio transcription using OpenAI Whisper API
Receives audio chunks via stdin and transcribes them
Supports separate mic and system audio streams
"""

import sys
import os
import numpy as np
import warnings
from datetime import datetime
from openai import OpenAI
import io
import wave

# Suppress warnings
warnings.filterwarnings("ignore")

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Get stream type from command line argument
STREAM_TYPE = sys.argv[1] if len(sys.argv) > 1 else "mic"
STREAM_ICON = "🎤" if STREAM_TYPE == "mic" else "🔊"
STREAM_LABEL = "You" if STREAM_TYPE == "mic" else "Other"

def log_message(message, include_label=False):
    """Print timestamped log message with optional stream label"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    if include_label:
        print(f"[{timestamp}] {STREAM_ICON} {STREAM_LABEL}: {message}", flush=True)
    else:
        print(f"[{timestamp}] {message}", flush=True)

def reduce_noise(audio_array):
    """Simple noise reduction using spectral gating"""
    # Calculate noise floor (first 0.5 seconds assumed to be noise)
    noise_sample_size = min(8000, len(audio_array) // 4)  # 0.5 seconds at 16kHz
    noise_floor = np.mean(np.abs(audio_array[:noise_sample_size]))
    
    # Apply soft threshold
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
    
    # Split into words or phrases
    words = text.split()
    if len(words) < 10:  # Need at least 10 words to be considered repetitive
        return False
    
    # Check for consecutive repeated words (only catch extreme cases like "the the the the the")
    consecutive_count = 1
    for i in range(1, len(words)):
        if words[i] == words[i-1]:
            consecutive_count += 1
            if consecutive_count >= 5:  # At least 5 consecutive same words
                return True
        else:
            consecutive_count = 1
    
    # Check for repeated phrases (only longer phrases 3-6 words)
    for phrase_len in range(3, 7):
        phrases = [' '.join(words[i:i+phrase_len]) for i in range(len(words) - phrase_len + 1)]
        # Count occurrences of each phrase
        from collections import Counter
        phrase_counts = Counter(phrases)
        # If any phrase appears more than 8 times, it's definitely repetitive
        if any(count > max_repetition for count in phrase_counts.values()):
            return True
    
    return False

def audio_to_wav_bytes(audio_array, sample_rate=16000):
    """Convert numpy audio array to WAV format bytes"""
    # Convert float32 to int16
    audio_int16 = (audio_array * 32767).astype(np.int16)
    
    # Create WAV file in memory
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 2 bytes for int16
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    
    wav_io.seek(0)
    return wav_io

def main():
    log_message(f"🎙️ Initializing OpenAI Whisper API ({STREAM_TYPE} stream)...")
    
    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        log_message("❌ OPENAI_API_KEY environment variable not set!")
        log_message("💡 Set it with: export OPENAI_API_KEY='your-api-key'")
        sys.exit(1)
    
    log_message(f"✅ OpenAI API ready for {STREAM_TYPE} audio")
    log_message(f"{STREAM_ICON} Ready to transcribe {STREAM_LABEL}'s audio...")
    log_message("")
    
    audio_buffer = []
    chunk_duration = 5.0  # Process every 8 seconds - better for conversations
    sample_rate = 16000
    samples_per_chunk = int(sample_rate * chunk_duration)
    
    try:
        # Read audio samples from stdin (sent by Swift)
        while True:
            line = sys.stdin.readline()
            if not line:
                break
                
            line = line.strip()
            if not line:
                continue
            
            # Parse the audio samples (comma-separated floats)
            try:
                samples = [float(x) for x in line.split(',') if x]
                audio_buffer.extend(samples)
                
                # Process when we have enough samples
                if len(audio_buffer) >= samples_per_chunk:
                    # Convert to numpy array
                    audio_array = np.array(audio_buffer[:samples_per_chunk], dtype=np.float32)
                    
                    # Skip silent chunks to save API calls and improve accuracy
                    if detect_silence(audio_array, threshold=0.008):  # Less aggressive - keep more audio
                        audio_buffer = audio_buffer[samples_per_chunk:]
                        continue
                    
                    # Apply noise reduction
                    audio_array = reduce_noise(audio_array)
                    
                    # Normalize audio
                    if np.max(np.abs(audio_array)) > 0:
                        audio_array = audio_array / np.max(np.abs(audio_array))
                    
                    # Convert to WAV format
                    wav_bytes = audio_to_wav_bytes(audio_array, sample_rate)
                    wav_bytes.name = "audio.wav"  # Required by OpenAI API
                    
                    # Transcribe using OpenAI API with improved parameters
                    try:
                        transcription = client.audio.transcriptions.create(
                            model="whisper-1",
                            file=wav_bytes,
                            language="en",
                            temperature=0.2  # Lower temperature for more consistent output
                        )
                        
                        text = transcription.text.strip()
                        
                        # Filter out various hallucinations
                        if text and not text.startswith("This is a meeting"):
                            # Check for repetitive hallucinations
                            if is_repetitive(text):
                                log_message(f"⚠️ Skipped repetitive hallucination (likely silence or unclear audio)")
                            else:
                                log_message(text, include_label=True)
                    except Exception as api_error:
                        log_message(f"❌ API Error: {api_error}")
                    
                    # Clear the processed audio (no overlap to avoid duplicates)
                    audio_buffer = audio_buffer[samples_per_chunk:]
                    
            except Exception as e:
                log_message(f"❌ Error processing audio: {e}")
                continue
                
    except KeyboardInterrupt:
        log_message("🛑 Transcription stopped")
    except Exception as e:
        log_message(f"❌ Fatal error: {e}")

if __name__ == "__main__":
    main()
