#!/bin/bash

# Test script for microphone capture feature

echo "🎤 Testing Remi Microphone Capture Feature"
echo "=========================================="
echo ""
echo "Step 1: Banner notification will appear"
echo "Step 2: Click 'Add Remi' button"
echo "Step 3: A floating controller window will open"
echo "Step 4: Click 'Start' to begin listening"
echo ""
echo "Features:"
echo "  ✅ Persistent floating control panel"
echo "  ✅ Real-time audio level visualization"
echo "  ✅ Pulsing green indicator when listening"
echo "  ✅ Translucent UI with rounded corners"
echo "  ✅ Draggable and always-on-top"
echo "  ✅ Console output showing audio levels"
echo ""
echo "Starting banner notification..."
echo ""

./remi_notifier "Click 'Add Remi' to open audio controller"
