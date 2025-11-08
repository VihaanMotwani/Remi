#!/bin/bash

# Start Agenda Tracking Meeting Assistant
# This runs both the agenda tracker server and the audio transcription

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check for agenda file
AGENDA_FILE="${1:-example_agenda.json}"

if [ ! -f "$AGENDA_FILE" ]; then
    echo "❌ Agenda file not found: $AGENDA_FILE"
    echo "💡 Usage: ./start_meeting_with_agenda.sh <agenda.json>"
    echo "📝 Using example agenda: example_agenda.json"
    AGENDA_FILE="example_agenda.json"
fi

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade requirements
echo "📦 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check for API key
if [ -z "$OPENAI_API_KEY" ]; then
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "❌ OPENAI_API_KEY not set!"
        echo "💡 Create a .env file with: OPENAI_API_KEY=your-key-here"
        exit 1
    fi
fi

echo ""
echo "🎯 ============================================"
echo "🎯  Remi - Meeting Assistant with Agenda Tracking"
echo "🎯 ============================================"
echo ""
echo "📋 Agenda: $AGENDA_FILE"
echo "🔑 API Key: ${OPENAI_API_KEY:0:10}..."
echo ""

# Start agenda tracker in background
echo "🚀 Starting agenda tracker server..."
cd "$SCRIPT_DIR/../backend/agents"
python3 agenda_tracker.py "$SCRIPT_DIR/$AGENDA_FILE" &
TRACKER_PID=$!

# Wait for server to start
sleep 2

# Go back to meeting-assistant directory
cd "$SCRIPT_DIR"

echo ""
echo "✅ Agenda tracker running (PID: $TRACKER_PID)"
echo "🌐 WebSocket server: ws://localhost:8765"
echo ""
echo "📱 Now open the floating controller:"
echo "   ./remi_controller"
echo ""
echo "💡 Or test transcription directly:"
echo "   python3 transcribe_audio_with_agenda.py mic"
echo ""
echo "🛑 Press Ctrl+C to stop everything"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $TRACKER_PID 2>/dev/null || true
    echo "✅ Stopped agenda tracker"
    exit 0
}

trap cleanup INT TERM

# Wait for interrupt
wait $TRACKER_PID
