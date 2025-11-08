#!/bin/bash

# Remi Setup Script
# Run this script to set up Remi in a new location

echo "🎤 Setting up Remi - Microphone Monitor"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3 from https://www.python.org/downloads/"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo ""

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q openai-whisper numpy soundfile

echo ""
echo "✅ Python dependencies installed"
echo ""

# Compile Swift files
echo "🔨 Compiling Swift components..."

# Compile the banner notifier
if swiftc -o remi_notifier RemiNotifier.swift 2>&1; then
    echo "✅ remi_notifier compiled"
else
    echo "❌ Failed to compile remi_notifier"
    exit 1
fi

# Compile the floating controller
if swiftc -o remi_controller RemiController.swift 2>&1; then
    echo "✅ remi_controller compiled"
else
    echo "❌ Failed to compile remi_controller"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Test the banner notification:"
echo "   ./remi_notifier \"Test message\""
echo ""
echo "2. Test the floating controller:"
echo "   ./test_controller.sh"
echo ""
echo "3. Test the full flow:"
echo "   ./test_mic_capture.sh"
echo ""
echo "4. Start monitoring (manual):"
echo "   ./remi.sh"
echo ""
echo "5. Install as background service:"
echo "   ./install_remi.sh"
echo ""
echo "ℹ️  Note: On first run, you'll need to grant microphone permissions"
echo ""
