#!/bin/bash

# Script to detect which processes are currently using the microphone on macOS

echo "==================================="
echo "Microphone Usage Detection Tool"
echo "==================================="
echo ""

# Function to check recent microphone access from system logs
check_recent_access() {
    echo "📊 Checking recent microphone access (last 5 minutes)..."
    echo ""
    
    # Get microphone access events and extract PIDs
    pids=$(log show --predicate 'process == "tccd" AND eventMessage CONTAINS "kTCCServiceMicrophone"' --last 5m --style compact 2>/dev/null | grep -oE "pid:[0-9]+" | cut -d: -f2 | sort -u)
    
    if [ -z "$pids" ]; then
        echo "ℹ️  No recent microphone access detected in the last 5 minutes."
        echo ""
        return
    fi
    
    echo "🎤 Processes that accessed the microphone:"
    echo ""
    
    for pid in $pids; do
        if ps -p "$pid" > /dev/null 2>&1; then
            process_info=$(ps -p "$pid" -o pid=,comm=,command= 2>/dev/null)
            echo "✓ ACTIVE: $process_info"
        else
            echo "✗ EXITED: Process $pid (no longer running)"
        fi
    done
    echo ""
}

# Function to check CoreAudio daemon status
check_coreaudio() {
    echo "🔊 CoreAudio Daemon Status:"
    echo ""
    ps aux | grep -i "coreaudiod" | grep -v grep | while read line; do
        echo "  $line"
    done
    echo ""
}

# Function to stream live microphone access (optional)
stream_live() {
    echo "🔴 Starting live monitoring (Press Ctrl+C to stop)..."
    echo "   Waiting for microphone access events..."
    echo ""
    
    log stream --predicate 'process == "tccd" AND eventMessage CONTAINS "kTCCServiceMicrophone"' --style compact 2>/dev/null | while read line; do
        # Extract PID from the log line
        if echo "$line" | grep -q "pid:"; then
            pid=$(echo "$line" | grep -oE "pid:[0-9]+" | head -1 | cut -d: -f2)
            if [ ! -z "$pid" ]; then
                timestamp=$(echo "$line" | awk '{print $1, $2}')
                process_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "Unknown")
                echo "[$timestamp] 🎤 Microphone access by: $process_name (PID: $pid)"
            fi
        fi
    done
}

# Main menu
case "${1:-check}" in
    check)
        check_recent_access
        check_coreaudio
        echo "💡 Tip: Run with 'live' argument to monitor in real-time:"
        echo "   ./detect_microphone.sh live"
        ;;
    live)
        stream_live
        ;;
    *)
        echo "Usage: $0 [check|live]"
        echo "  check - Check recent microphone access (default)"
        echo "  live  - Monitor microphone access in real-time"
        exit 1
        ;;
esac
