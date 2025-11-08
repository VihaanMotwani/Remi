# 🎤 Remi - Microphone Monitor

**"Knock-knock, it's Remi"** - A friendly watchdog that alerts you whenever an app uses your microphone on macOS.

## Features

- 🔔 **Real-time notifications** - Get instant alerts when apps access your microphone
- 🤖 **Runs in background** - Silently monitors without interrupting your workflow
- 🚀 **Auto-start on login** - Set it and forget it
- 🔍 **Process tracking** - Shows which app is using the mic
- 🎯 **Smart notifications** - Only notifies once per app session

## Quick Start

### Option 1: Test it manually
```bash
./remi.sh
```
Press Ctrl+C to stop.

### Option 2: Install as background service (recommended)
```bash
./install_remi.sh
```

This will make Remi start automatically every time you log in!

## Files

- `remi.sh` - Main monitoring script
- `install_remi.sh` - Installation script for background service
- `detect_microphone.sh` - Manual tool to check current microphone usage
- `com.remi.micmonitor.plist` - LaunchAgent configuration

## Usage

### Start/Stop/Uninstall

```bash
# Stop Remi
launchctl unload ~/Library/LaunchAgents/com.remi.micmonitor.plist

# Start Remi
launchctl load ~/Library/LaunchAgents/com.remi.micmonitor.plist

# Uninstall completely
launchctl unload ~/Library/LaunchAgents/com.remi.micmonitor.plist
rm ~/Library/LaunchAgents/com.remi.micmonitor.plist

# View logs
tail -f /tmp/remi.log
```

### Check current microphone usage
```bash
# Quick check
./detect_microphone.sh

# Live monitoring
./detect_microphone.sh live
```

## How it works

Remi monitors macOS system logs for microphone access requests (via the TCC - Transparency, Consent, and Control system). When an app requests microphone access, Remi:

1. Captures the process ID
2. Looks up the app name
3. Shows a native macOS notification
4. Tracks the notification to avoid duplicates

## Privacy

- All monitoring is done locally on your machine
- No data is sent anywhere
- Uses standard macOS APIs
- Open source - you can inspect the code!

## Requirements

- macOS (tested on modern versions)
- Bash
- System log access (no special permissions needed)

## Troubleshooting

**No notifications appearing?**
- Check if notifications are enabled for Script Editor/Terminal in System Preferences
- View logs: `tail -f /tmp/remi.log`

**Remi not starting automatically?**
- Verify it's loaded: `launchctl list | grep remi`
- Check error logs: `cat /tmp/remi.error.log`

## Credits

Built with ❤️ for privacy-conscious Mac users
