#!/bin/bash

# Remi - Microphone Usage Monitor
# Shows a notification whenever a process accesses your microphone

NOTIFICATION_TITLE="Knock-knock, it's Remi"
TRACKING_FILE="/tmp/remi_mic_tracking.txt"
COOLDOWN_SECONDS=30  # Notify again after 30 seconds for the same app

# Initialize tracking file
touch "$TRACKING_FILE"

echo "🎤 Remi is now watching your microphone..."
echo "Press Ctrl+C to stop"
echo ""

# Function to send notification as a banner/alert
send_notification() {
    local process_name="$1"
    local pid="$2"
    
    # Use Swift notifier for beautiful banner
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    "$SCRIPT_DIR/remi_notifier" "to keep you on track" &
    
    echo "[$(date '+%H:%M:%S')] 🔔 Banner shown: $process_name (PID: $pid)"
}

# Function to check if we've recently notified about this app
recently_notified() {
    local process_name="$1"
    local current_time=$(date +%s)
    
    # Check if there's a recent notification for this app
    if grep -q "^${process_name}:" "$TRACKING_FILE" 2>/dev/null; then
        local last_time=$(grep "^${process_name}:" "$TRACKING_FILE" | tail -1 | cut -d: -f2)
        
        # Validate that last_time is a number
        if [[ "$last_time" =~ ^[0-9]+$ ]]; then
            local time_diff=$((current_time - last_time))
            
            if [ $time_diff -lt $COOLDOWN_SECONDS ]; then
                return 0  # Recently notified
            fi
        fi
    fi
    
    return 1  # Not recently notified
}

# Function to update notification timestamp
update_notification_time() {
    local process_name="$1"
    local current_time=$(date +%s)
    
    # Remove old entry for this app
    grep -v "^${process_name}:" "$TRACKING_FILE" > "${TRACKING_FILE}.tmp" 2>/dev/null
    mv "${TRACKING_FILE}.tmp" "$TRACKING_FILE" 2>/dev/null
    
    # Add new entry with current timestamp
    echo "${process_name}:${current_time}" >> "$TRACKING_FILE"
}

# Cleanup on exit
trap "rm -f $TRACKING_FILE; echo ''; echo '👋 Remi stopped monitoring'; exit 0" INT TERM EXIT

# Monitor microphone access in real-time
log stream --predicate 'process == "tccd" AND eventMessage CONTAINS "kTCCServiceMicrophone"' --style compact 2>/dev/null | while read line; do
    # Extract PID from the log line
    if echo "$line" | grep -q "pid:"; then
        pid=$(echo "$line" | grep -oE "pid:[0-9]+" | head -1 | cut -d: -f2)
        
        if [ ! -z "$pid" ]; then
            # Get process name (just the app name, not full path) and clean it
            process_name=$(ps -p "$pid" -o comm= 2>/dev/null | xargs basename | tr -d '\n' | tr ' ' '_')
            
            if [ ! -z "$process_name" ] && ! recently_notified "$process_name"; then
                # Send notification with generic message
                send_notification "to keep you on track" "$pid"
                
                # Update timestamp using sanitized name
                update_notification_time "$process_name"
            fi
        fi
    fi
done
