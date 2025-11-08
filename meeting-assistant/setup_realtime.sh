#!/bin/bash

# Quick Setup Script for Realtime API Migration

echo "🚀 Setting up Realtime API for Remi Meeting Assistant"
echo "======================================================"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 1. Check Python virtual environment
echo "📦 Step 1: Checking Python environment..."
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "⚠️  Virtual environment not found. Creating..."
    python3 -m venv "$SCRIPT_DIR/venv"
fi

source "$SCRIPT_DIR/venv/bin/activate"

# 2. Install/upgrade dependencies
echo ""
echo "📥 Step 2: Installing dependencies..."
pip install --upgrade pip
pip install -r "$SCRIPT_DIR/requirements.txt"

# 3. Check OpenAI API key
echo ""
echo "🔑 Step 3: Checking OpenAI API key..."
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not found!"
    echo "Please create a .env file with:"
    echo "  OPENAI_API_KEY=sk-..."
    echo ""
else
    echo "✅ API key found (${OPENAI_API_KEY:0:8}...)"
fi

# 4. Make scripts executable
echo ""
echo "🔧 Step 4: Setting permissions..."
chmod +x "$SCRIPT_DIR/run_transcription_realtime.sh"
chmod +x "$SCRIPT_DIR/detect_microphone.sh"
chmod +x "$SCRIPT_DIR/remi.sh"

# 5. Compile Swift controller
echo ""
echo "🔨 Step 5: Compiling Swift controller..."
swiftc -o "$SCRIPT_DIR/remi_controller" \
    "$SCRIPT_DIR/RemiController.swift" \
    -framework Cocoa \
    -framework SwiftUI \
    -framework AVFoundation \
    -framework ScreenCaptureKit

if [ $? -eq 0 ]; then
    echo "✅ Controller compiled successfully"
else
    echo "❌ Controller compilation failed"
    exit 1
fi

# 6. Compile Swift notifier
echo ""
echo "🔨 Step 6: Compiling Swift notifier..."
swiftc -o "$SCRIPT_DIR/remi_notifier" \
    "$SCRIPT_DIR/RemiNotifier.swift" \
    -framework Cocoa \
    -framework SwiftUI

if [ $? -eq 0 ]; then
    echo "✅ Notifier compiled successfully"
else
    echo "❌ Notifier compilation failed"
    exit 1
fi

# 7. Test setup
echo ""
echo "🧪 Step 7: Testing setup..."
python3 -c "import websockets, openai, numpy; print('✅ All Python packages imported successfully')"

echo ""
echo "✨ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Start agenda tracker:"
echo "   cd $SCRIPT_DIR"
echo "   python3 ../backend/agents/agenda_tracker.py example_agenda.json"
echo ""
echo "2. In another terminal, launch controller:"
echo "   cd $SCRIPT_DIR"
echo "   ./remi_controller"
echo ""
echo "3. Click 'Start' and speak about agenda items!"
echo ""
echo "📖 See REALTIME_MIGRATION.md for more details"
