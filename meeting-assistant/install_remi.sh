#!/bin/bash

# Remi Installation Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_NAME="com.remi.micmonitor.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "🎤 Installing Remi - Microphone Monitor"
echo "========================================"
echo ""

# Create LaunchAgents directory if it doesn't exist
if [ ! -d "$LAUNCH_AGENTS_DIR" ]; then
    echo "📁 Creating LaunchAgents directory..."
    mkdir -p "$LAUNCH_AGENTS_DIR"
fi

# Copy plist file
echo "📋 Installing launch agent..."
cp "$PLIST_SOURCE" "$PLIST_DEST"

# Load the launch agent
echo "🚀 Starting Remi..."
launchctl unload "$PLIST_DEST" 2>/dev/null
launchctl load "$PLIST_DEST"

echo ""
echo "✅ Remi is now installed and running!"
echo ""
echo "📝 Remi will:"
echo "   • Start automatically when you log in"
echo "   • Show a notification when any app uses your microphone"
echo "   • Run silently in the background"
echo ""
echo "🔧 Useful commands:"
echo "   • Stop Remi:     launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "   • Start Remi:    launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo "   • Uninstall:     rm ~/Library/LaunchAgents/$PLIST_NAME"
echo "   • View logs:     tail -f /tmp/remi.log"
echo "   • Test manually: ./remi.sh"
echo ""
