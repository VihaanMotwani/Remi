#!/bin/bash

# Wrapper script to run Realtime API transcription with proper Python environment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STREAM_TYPE="${1:-mic}"  # Default to 'mic' if not provided

# Load .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Activate virtual environment if it exists
if [ -d "$SCRIPT_DIR/venv" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# Run the Realtime API transcription script
python3 "$SCRIPT_DIR/transcribe_realtime.py" "$STREAM_TYPE"
