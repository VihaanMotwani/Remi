#!/usr/bin/env python3
"""
Real-time audio transcription using OpenAI Realtime API
Replaces Whisper-based transcription for lower latency and better accuracy
"""

import sys
import os
import asyncio
import websockets
import json
import base64
import struct
from datetime import datetime

# Get stream type from command line argument
STREAM_TYPE = sys.argv[1] if len(sys.argv) > 1 else "mic"
STREAM_ICON = "🎤" if STREAM_TYPE == "mic" else "🔊"
STREAM_LABEL = "You" if STREAM_TYPE == "mic" else "Other"

# WebSocket connection to agenda tracker
AGENDA_TRACKER_URL = "ws://localhost:8765"
agenda_ws = None

# OpenAI Realtime API
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
REALTIME_API_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"


def log_message(message, include_label=False):
    """Print timestamped log message with optional stream label"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    if include_label:
        print(f"[{timestamp}] {STREAM_ICON} {STREAM_LABEL}: {message}", flush=True)
    else:
        print(f"[{timestamp}] {message}", flush=True)


async def connect_to_agenda_tracker():
    """Connect to agenda tracker WebSocket"""
    global agenda_ws
    try:
        agenda_ws = await websockets.connect(AGENDA_TRACKER_URL)
        log_message("🔌 Connected to agenda tracker")
    except Exception as e:
        log_message(f"⚠️ Could not connect to agenda tracker: {e}")


async def send_to_agenda_tracker(speaker: str, text: str):
    """Send transcription to agenda tracker via WebSocket"""
    global agenda_ws
    
    try:
        if agenda_ws is None:
            await connect_to_agenda_tracker()
        
        message = json.dumps({
            "type": "transcription",
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        
        await agenda_ws.send(message)
    except Exception as e:
        log_message(f"⚠️ Could not send to agenda tracker: {e}")
        agenda_ws = None


async def handle_realtime_events(realtime_ws):
    """Handle incoming events from Realtime API"""
    async for message in realtime_ws:
        try:
            event = json.loads(message)
            event_type = event.get("type")
            
            if event_type == "session.created":
                log_message("✅ Realtime API session created")
            
            elif event_type == "conversation.item.created":
                # New conversation item (could be transcript)
                pass
            
            elif event_type == "response.audio_transcript.delta":
                # Partial transcript chunk
                transcript_delta = event.get("delta", "")
                if transcript_delta:
                    # Buffer these for complete sentences
                    pass
            
            elif event_type == "response.audio_transcript.done":
                # Complete transcript available
                transcript = event.get("transcript", "")
                if transcript and transcript.strip():
                    log_message(transcript, include_label=True)
                    await send_to_agenda_tracker(STREAM_LABEL, transcript)
            
            elif event_type == "conversation.item.input_audio_transcription.completed":
                # Input audio transcription complete (VAD detected end of speech)
                transcript = event.get("transcript", "")
                if transcript and transcript.strip():
                    log_message(transcript, include_label=True)
                    await send_to_agenda_tracker(STREAM_LABEL, transcript)
            
            elif event_type == "error":
                error_msg = event.get("error", {})
                log_message(f"❌ Realtime API error: {error_msg}")
        
        except json.JSONDecodeError:
            log_message(f"⚠️ Could not parse event: {message}")
        except Exception as e:
            log_message(f"⚠️ Error handling event: {e}")


def pcm_to_base64(samples):
    """Convert float32 samples to base64-encoded PCM16"""
    # Convert float32 [-1, 1] to int16 [-32768, 32767]
    pcm_data = bytearray()
    for sample in samples:
        # Clamp to [-1, 1]
        sample = max(-1.0, min(1.0, sample))
        # Convert to int16
        pcm_value = int(sample * 32767)
        pcm_data.extend(struct.pack('<h', pcm_value))
    
    return base64.b64encode(pcm_data).decode('utf-8')


async def stream_audio_to_realtime(realtime_ws):
    """Read audio samples from stdin and stream to Realtime API"""
    log_message(f"🎙️ Ready to stream {STREAM_TYPE} audio to Realtime API...")
    
    try:
        loop = asyncio.get_event_loop()
        
        while True:
            # Read line from stdin (non-blocking)
            line = await loop.run_in_executor(None, sys.stdin.readline)
            
            if not line:
                log_message(f"⚠️ Stdin closed for {STREAM_TYPE}, exiting...")
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                # Parse comma-separated float samples
                samples = [float(x) for x in line.split(',') if x]
                
                if not samples:
                    continue
                
                # Convert to PCM16 base64
                audio_base64 = pcm_to_base64(samples)
                
                # Send to Realtime API
                event = {
                    "type": "input_audio_buffer.append",
                    "audio": audio_base64
                }
                
                await realtime_ws.send(json.dumps(event))
            
            except ValueError as e:
                log_message(f"⚠️ Invalid sample data: {e}")
            except Exception as e:
                log_message(f"⚠️ Error streaming audio: {e}")
    
    except asyncio.CancelledError:
        log_message(f"🛑 Audio streaming cancelled for {STREAM_TYPE}")
    except Exception as e:
        log_message(f"❌ Fatal error streaming audio: {e}")


async def main():
    """Main async entry point"""
    if not OPENAI_API_KEY:
        log_message("❌ OPENAI_API_KEY environment variable not set!")
        sys.exit(1)
    
    log_message(f"🚀 Starting Realtime API transcription: {STREAM_TYPE}")
    
    try:
        # Connect to OpenAI Realtime API
        # Build headers as list of tuples for websockets library
        headers = [
            ("Authorization", f"Bearer {OPENAI_API_KEY}"),
            ("OpenAI-Beta", "realtime=v1")
        ]
        
        async with websockets.connect(REALTIME_API_URL, additional_headers=headers) as realtime_ws:
            log_message("🔗 Connected to OpenAI Realtime API")
            
            # Configure session for transcription only
            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["text"],  # We only want transcripts, not audio responses
                    "instructions": f"You are a transcription assistant. Only transcribe the {STREAM_LABEL}'s speech accurately. Do not respond or add commentary.",
                    "voice": "alloy",  # Doesn't matter since we're not using audio output
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {
                        "model": "whisper-1"
                    },
                    "turn_detection": {
                        "type": "server_vad",  # Server-side Voice Activity Detection
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500
                    }
                }
            }
            
            await realtime_ws.send(json.dumps(session_config))
            log_message("⚙️ Session configured for transcription")
            
            # Run both tasks concurrently
            event_handler = asyncio.create_task(handle_realtime_events(realtime_ws))
            audio_streamer = asyncio.create_task(stream_audio_to_realtime(realtime_ws))
            
            # Wait for both to complete (or one to fail)
            await asyncio.gather(event_handler, audio_streamer)
    
    except websockets.exceptions.WebSocketException as e:
        log_message(f"❌ Failed to connect to Realtime API: {e}")
    except Exception as e:
        log_message(f"❌ Fatal error: {e}")
        import traceback
        log_message(traceback.format_exc())
    finally:
        # Cleanup
        if agenda_ws:
            await agenda_ws.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log_message(f"🛑 Transcription stopped ({STREAM_TYPE})")
