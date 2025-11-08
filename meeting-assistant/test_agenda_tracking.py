#!/usr/bin/env python3
"""
Test script for agenda tracker
Simulates a meeting conversation to test agenda tracking
"""

import asyncio
import websockets
import json
from datetime import datetime

# Simulated conversation about Q4 planning
CONVERSATION = [
    ("You", "Alright everyone, let's start our Q4 planning meeting."),
    ("Other", "Sounds good! What's on the agenda?"),
    ("You", "First, I want to talk about our Q3 performance. Overall, we hit 95% of our targets."),
    ("Other", "That's great! Any major blockers we should discuss?"),
    ("You", "A few minor ones, but we resolved them. The team did an excellent job."),
    ("Other", "Awesome. What's next?"),
    ("You", "Let me think about features... We should prioritize the new dashboard."),
    ("Other", "Agreed. What about the mobile app redesign?"),
    ("You", "Yes, that's high priority too. Should we discuss the timeline?"),
    ("Other", "Definitely. When do you want to ship the dashboard?"),
    ("You", "I'm thinking mid-December. That gives us 6 weeks."),
    ("Other", "That works. We should probably assign teams to these projects."),
    ("You", "Good point. Sarah can lead the dashboard, and Mike handles mobile."),
    ("Other", "Perfect. One thing though - what about the budget? We haven't discussed funding."),
    ("You", "Oh right! We have $150k allocated for Q4. That should cover both projects."),
    ("Other", "Great, that's exactly what we needed to know."),
]


async def test_agenda_tracker():
    """Send simulated conversation to agenda tracker"""
    uri = "ws://localhost:8765"
    
    print("🧪 Testing Agenda Tracker")
    print("=" * 50)
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to agenda tracker")
            
            # Receive initial state
            initial = await websocket.recv()
            data = json.loads(initial)
            print(f"\n📋 Meeting: {data['data']['meetingTitle']}")
            print(f"📊 Agenda items: {len(data['data']['items'])}")
            
            for item in data['data']['items']:
                print(f"   - {item['title']} ({item['status']})")
            
            print("\n🎬 Starting simulated conversation...")
            print("-" * 50)
            
            # Send conversation chunks with delays
            for speaker, text in CONVERSATION:
                await asyncio.sleep(2)  # Simulate realistic pauses
                
                # Send transcription
                message = {
                    "type": "transcription",
                    "speaker": speaker,
                    "text": text,
                    "timestamp": datetime.now().isoformat()
                }
                
                await websocket.send(json.dumps(message))
                print(f"\n{speaker}: {text}")
                
                # Wait for state update
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    state = json.loads(response)
                    
                    if state.get('type') == 'state_update':
                        # Show prompts if any
                        prompts = state['data'].get('prompts', [])
                        if prompts:
                            print("\n💡 Prompts:")
                            for prompt in prompts:
                                priority_emoji = {
                                    'high': '🔴',
                                    'medium': '🟡',
                                    'low': '🟢'
                                }.get(prompt['priority'], '⚪')
                                print(f"   {priority_emoji} {prompt['message']}")
                        
                        # Show item statuses
                        items = state['data'].get('items', [])
                        covered = [i for i in items if i['status'] == 'covered']
                        in_progress = [i for i in items if i['status'] == 'in-progress']
                        
                        if covered or in_progress:
                            print("\n📊 Status:")
                            if in_progress:
                                print(f"   🔵 In progress: {', '.join([i['title'] for i in in_progress])}")
                            if covered:
                                print(f"   ✅ Covered: {', '.join([i['title'] for i in covered])}")
                
                except asyncio.TimeoutError:
                    pass  # No state update yet
            
            # Final status
            print("\n" + "=" * 50)
            print("🎬 Conversation ended")
            print("\n📊 Final Agenda Status:")
            
            # Request final state
            await websocket.send(json.dumps({"type": "get_state"}))
            final = await websocket.recv()
            final_data = json.loads(final)
            
            for item in final_data['data']['items']:
                status_emoji = {
                    'not-started': '⚪',
                    'in-progress': '🔵',
                    'covered': '✅',
                    'skipped': '⏭️'
                }.get(item['status'], '⚪')
                print(f"   {status_emoji} {item['title']} - {item['status']}")
            
            print("\n✨ Test completed!")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Make sure the agenda tracker is running:")
        print("   python3 agenda_tracker.py example_agenda.json")


if __name__ == "__main__":
    asyncio.run(test_agenda_tracker())
