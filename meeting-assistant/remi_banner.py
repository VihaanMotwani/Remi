#!/usr/bin/env python3
"""
Remi Banner - Shows a top banner notification when microphone is accessed
"""

import sys
import subprocess
from datetime import datetime

def show_banner(app_name):
    """Show a banner at the top of the screen using AppleScript"""
    
    # Escape single quotes in app name
    app_name_escaped = app_name.replace("'", "'\\''")
    
    script = f'''display alert "🎤 Knock-knock, it's Remi" message "{app_name_escaped} is using your microphone" as critical giving up after 5'''
    
    try:
        subprocess.run(['osascript', '-e', script], check=True, capture_output=True)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Banner shown for: {app_name}")
    except subprocess.CalledProcessError as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Error showing banner: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: remi_banner.py <app_name>")
        sys.exit(1)
    
    app_name = " ".join(sys.argv[1:])
    show_banner(app_name)
