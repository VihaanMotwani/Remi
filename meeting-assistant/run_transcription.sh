#!/bin/bash

# Wrapper script to run transcription with proper Python environment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STREAM_TYPE="${1:-mic}"  # Default to 'mic' if not provided

# Activate virtual environment if it exists
if [ -d "$SCRIPT_DIR/venv" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# Export OPENAI_API_KEY if not already set
# The key should be passed from the parent process
export OPENAI_API_KEY="${OPENAI_API_KEY}"

# Run the transcription script with agenda tracking
python3 "$SCRIPT_DIR/transcribe_audio_with_agenda.py" "$STREAM_TYPE"
