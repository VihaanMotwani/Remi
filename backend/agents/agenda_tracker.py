#!/usr/bin/env python3
"""
Live Agenda Tracker for Meeting Assistant
Analyzes real-time transcription against predefined agendas
Generates intelligent prompts when items are missed or could be expanded
"""

import os
import sys
import json
import asyncio
import websockets
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from openai import OpenAI
from pathlib import Path

# Load .env file if it exists
env_file = Path(__file__).parent.parent.parent / "meeting-assistant" / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


@dataclass
class AgendaItem:
    id: str
    title: str
    description: str = ""
    status: str = "not-started"  # not-started, in-progress, covered, skipped
    sub_items: List['AgendaItem'] = None
    covered_at: Optional[str] = None
    keywords: List[str] = None
    estimated_minutes: int = 5

    def __post_init__(self):
        if self.sub_items is None:
            self.sub_items = []
        if self.keywords is None:
            self.keywords = []


@dataclass
class AgendaPrompt:
    id: str
    type: str  # missing, expand, off-track
    message: str
    related_item_id: str
    priority: str  # low, medium, high
    created_at: str


@dataclass
class TranscriptionChunk:
    timestamp: str
    speaker: str  # "You" or "Other"
    text: str


class AgendaTracker:
    def __init__(self, agenda_file: str = None):
        self.agenda_items: List[AgendaItem] = []
        self.conversation_history: List[TranscriptionChunk] = []
        self.active_prompts: List[AgendaPrompt] = []
        self.meeting_title = ""
        self.meeting_start = datetime.now().isoformat()
        self.prompt_counter = 0  # For generating unique IDs
        
        if agenda_file and os.path.exists(agenda_file):
            self.load_agenda(agenda_file)
        
        print(f"🎯 Agenda Tracker initialized with {len(self.agenda_items)} items")
    
    def load_agenda(self, file_path: str):
        """Load predefined agenda from JSON file"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                self.meeting_title = data.get('meetingTitle', 'Untitled Meeting')
                
                for item_data in data.get('items', []):
                    item = AgendaItem(
                        id=item_data['id'],
                        title=item_data['title'],
                        description=item_data.get('description', ''),
                        keywords=item_data.get('keywords', []),
                        estimated_minutes=item_data.get('estimatedMinutes', 5)
                    )
                    self.agenda_items.append(item)
                
                print(f"✅ Loaded agenda: {self.meeting_title}")
                for item in self.agenda_items:
                    print(f"   📋 {item.title}")
        except Exception as e:
            print(f"❌ Error loading agenda: {e}")
    
    def add_transcription(self, speaker: str, text: str):
        """Add new transcription chunk and analyze"""
        chunk = TranscriptionChunk(
            timestamp=datetime.now().isoformat(),
            speaker=speaker,
            text=text
        )
        self.conversation_history.append(chunk)
        
        # Keep only last 50 chunks for context (memory management)
        if len(self.conversation_history) > 50:
            self.conversation_history = self.conversation_history[-50:]
        
        # Analyze against agenda
        self._analyze_conversation()
    
    def _simple_keyword_check(self, text: str) -> set:
        """Simple keyword matching to pre-detect mentioned items"""
        text_lower = text.lower()
        mentioned = set()
        
        # Check each item's keywords
        for item in self.agenda_items:
            for keyword in item.keywords:
                if keyword.lower() in text_lower:
                    mentioned.add(item.id)
                    break
        
        return mentioned
    
    def _analyze_conversation(self):
        """Analyze recent conversation against agenda using LLM"""
        if not self.agenda_items:
            return
        
        # Analyze after every new chunk for maximum responsiveness
        print(f"🔍 Analyzing conversation... (Total chunks: {len(self.conversation_history)})")
        
        # Get last 10 chunks for context
        recent_chunks = self.conversation_history[-10:]
        conversation_text = "\n".join([
            f"{chunk.speaker}: {chunk.text}" 
            for chunk in recent_chunks
        ])
        
        # Pre-check: Simple keyword matching on last 3 chunks
        recent_text = " ".join([chunk.text for chunk in recent_chunks[-3:]])
        keyword_matches = self._simple_keyword_check(recent_text)
        if keyword_matches:
            print(f"🎯 Keyword matches found: {keyword_matches}")
        
        # Build agenda context
        agenda_context = []
        for item in self.agenda_items:
            status_emoji = {
                'not-started': '⚪',
                'in-progress': '🔵',
                'covered': '✅',
                'skipped': '⏭️'
            }.get(item.status, '⚪')
            
            agenda_context.append(
                f"{status_emoji} {item.title} (Status: {item.status})\n"
                f"   Description: {item.description}\n"
                f"   Keywords: {', '.join(item.keywords)}"
            )
        
        agenda_text = "\n".join(agenda_context)
        
        # LLM Analysis Prompt
        prompt = f"""You are an AI meeting assistant tracking agenda items in real-time.

CURRENT AGENDA STATUS (PRESERVE THESE STATES):
{agenda_text}

NOTE: If an item shows "Status: in-progress" or "Status: covered", you MUST keep it that way in your response. 
Never downgrade from covered/in-progress back to missed.

RECENT CONVERSATION:
{conversation_text}

Analyze the conversation and determine:
1. Which agenda item(s) are currently being discussed (if any)
2. Which items have been fully covered
3. Which items are being missed or skipped
4. Whether the conversation is on-track or off-topic

CRITICAL COVERAGE RULES - ULTRA-AGGRESSIVE FUZZY MATCHING:

KEYWORD MATCHING (be very loose):
- "budget", "cost", "money", "funding" → Budget Allocation
- "Q3", "performance", "metrics", "results" → Review Q3 Performance  
- "feature", "roadmap", "features" → Feature Roadmap
- "timeline", "milestone", "schedule", "deadline", "plan" → Timeline & Milestones
- "team", "assign", "role" → Team Assignments

COVERAGE DETECTION (mark in_progress or covered immediately):
- If you see ANY keyword in the last 3 messages → mark as "in_progress"
- If you see keyword + ANY details (numbers, decisions, discussion) → mark as "covered"
- Words like "should", "need to", "let's", "think about" + keyword → mark as "in_progress"
- Once marked "in_progress" or "covered" → NEVER EVER revert to "missed"

EXAMPLE: User says "we should think about the timeline" → MUST mark item_4 as "in_progress"
EXAMPLE: User says "feature" or "features" → MUST mark item_3 as "in_progress"
EXAMPLE: User says "$10" while discussing budget → mark item_2 as "covered"

BE AGGRESSIVE: When in doubt, always mark as in_progress/covered rather than missed!

PROMPT TONE & STYLE:
- Be warm, friendly, and supportive like a helpful colleague
- Use encouraging language and positive framing
- Make suggestions feel natural and conversational, not robotic
- Add gentle emojis where appropriate (sparingly)
- Keep messages concise but personable (10-15 words ideal)
- Examples:
  * "Discuss the budget when you're ready! 💭"
  * "Ooh what about team assignments 😊"
  * "Shall we circle back to the timeline? No rush! ⏰"

MATCHING RULES - Be precise, not overeager:
- Only mark an item "in_progress" if it's ACTIVELY discussed in the last 1-2 messages
- Only mark "covered" if there's substantial discussion (2+ exchanges with details/decisions)
- If unsure, leave as "missed" - don't guess
- Preserve existing status: items already "in_progress" or "covered" stay that way

Respond ONLY with valid JSON in this exact format:
{{
  "current_topic": "agenda item title or 'off-topic'",
  "items_in_progress": ["item_1"],
  "items_covered": ["item_2"],
  "items_missed": ["item_3"],
  "prompts": [
    {{
      "type": "missing",
      "message": "Warm, friendly suggestion about the topic",
      "related_item_id": "Budget Allocation",
      "priority": "medium"
    }}
  ]
}}

CRITICAL RULES: 
- items_in_progress, items_covered, items_missed use item IDs (like "item_1", "item_2")
- related_item_id in prompts uses item TITLES (like "Budget Allocation")
- Generate 0-2 prompts ONLY. Do NOT always generate prompts.
- NEVER generate prompts for items in items_covered or items_in_progress
- NEVER generate multiple prompts for the same item
- Only generate prompts for items in items_missed that are truly being ignored
- If only 1-2 items are missed, only generate 1-2 prompts (not 3)
"""
        
        try:
            print(f"🤖 Calling LLM for analysis...")
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a meeting agenda tracking assistant. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content
            print(f"📥 LLM Response: {result_text[:200]}...")
            
            result = json.loads(result_text)
            self._update_agenda_status(result)
            self._generate_prompts(result)
            
        except json.JSONDecodeError as e:
            print(f"⚠️ Failed to parse LLM response: {e}")
            print(f"Raw response: {result_text}")
        except Exception as e:
            print(f"⚠️ Analysis error: {e}")
    
    def _update_agenda_status(self, analysis: Dict):
        """Update agenda item statuses based on analysis"""
        covered_items = set()
        
        for item in self.agenda_items:
            if item.id in analysis.get('items_covered', []):
                if item.status != 'covered':
                    item.status = 'covered'
                    item.covered_at = datetime.now().isoformat()
                    print(f"✅ Covered: {item.title}")
                covered_items.add(item.id)
            
            elif item.id in analysis.get('items_in_progress', []):
                if item.status == 'not-started':
                    item.status = 'in-progress'
                    print(f"🔵 Started: {item.title}")
        
        # Auto-dismiss prompts for covered or in-progress items
        # Note: related_item_id is the TITLE, not the ID
        if covered_items or analysis.get('items_in_progress'):
            # Build set of titles for addressed items
            addressed_titles = set()
            for item in self.agenda_items:
                if item.id in covered_items or item.id in analysis.get('items_in_progress', []):
                    addressed_titles.add(item.title)
            
            before_count = len(self.active_prompts)
            self.active_prompts = [
                p for p in self.active_prompts 
                if p.related_item_id not in addressed_titles
            ]
            dismissed = before_count - len(self.active_prompts)
            if dismissed > 0:
                print(f"🗑️ Auto-dismissed {dismissed} prompts for: {addressed_titles}")
    
    def _generate_prompts(self, analysis: Dict):
        """Generate UI prompts based on analysis"""
        new_prompts = []
        
        for prompt_data in analysis.get('prompts', []):
            # Avoid duplicate prompts - check both exact message AND same item
            existing = any(
                (p.message == prompt_data['message']) or 
                (p.related_item_id == prompt_data['related_item_id'])
                for p in self.active_prompts
            )
            
            if not existing:
                self.prompt_counter += 1
                prompt = AgendaPrompt(
                    id=f"prompt_{self.prompt_counter}_{int(datetime.now().timestamp() * 1000)}",
                    type=prompt_data['type'],
                    message=prompt_data['message'],
                    related_item_id=prompt_data['related_item_id'],
                    priority=prompt_data['priority'],
                    created_at=datetime.now().isoformat()
                )
                new_prompts.append(prompt)
                print(f"💡 New prompt: {prompt.message}")
        
        # Add new prompts
        self.active_prompts.extend(new_prompts)
        
        # Limit prompts but don't force filling to 3
        # Only keep truly important ones (max 3, but can be fewer)
        if len(self.active_prompts) > 3:
            priority_order = {'high': 3, 'medium': 2, 'low': 1}
            self.active_prompts.sort(
                key=lambda p: priority_order.get(p.priority, 0), 
                reverse=True
            )
            self.active_prompts = self.active_prompts[:3]
    
    def dismiss_prompt(self, prompt_id: str):
        """Remove a prompt (e.g., when user addresses it)"""
        self.active_prompts = [p for p in self.active_prompts if p.id != prompt_id]
        print(f"🗑️ Dismissed prompt: {prompt_id}")
    
    def get_state(self) -> Dict:
        """Get current agenda state for UI"""
        return {
            "meetingTitle": self.meeting_title,
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "status": item.status,
                    "coveredAt": item.covered_at,
                    "keywords": item.keywords
                }
                for item in self.agenda_items
            ],
            "prompts": [
                {
                    "id": p.id,
                    "type": p.type,
                    "message": p.message,
                    "relatedItemId": p.related_item_id,
                    "priority": p.priority,
                    "createdAt": p.created_at
                }
                for p in self.active_prompts
            ],
            "conversationCount": len(self.conversation_history)
        }


# WebSocket Server for real-time communication with Swift UI
class AgendaWebSocketServer:
    def __init__(self, tracker: AgendaTracker, port: int = 8765):
        self.tracker = tracker
        self.port = port
        self.clients = set()
    
    async def handler(self, websocket):
        """Handle WebSocket connections"""
        self.clients.add(websocket)
        client_id = id(websocket)
        print(f"🔌 Client #{client_id} connected (total: {len(self.clients)})")
        
        try:
            # Send initial state
            await websocket.send(json.dumps({
                "type": "initial_state",
                "data": self.tracker.get_state()
            }))
            
            async for message in websocket:
                data = json.loads(message)
                
                if data['type'] == 'transcription':
                    # Receive transcription from Swift
                    self.tracker.add_transcription(
                        speaker=data['speaker'],
                        text=data['text']
                    )
                    
                    # Broadcast updated state to all clients
                    await self.broadcast_state()
                
                elif data['type'] == 'dismiss_prompt':
                    self.tracker.dismiss_prompt(data['promptId'])
                    await self.broadcast_state()
                
                elif data['type'] == 'get_state':
                    await websocket.send(json.dumps({
                        "type": "state_update",
                        "data": self.tracker.get_state()
                    }))
        
        except websockets.exceptions.ConnectionClosed as e:
            print(f"⚠️ Client #{client_id} connection closed: {e.reason if hasattr(e, 'reason') else 'unknown'}")
        except Exception as e:
            print(f"❌ Client #{client_id} error: {e}")
        finally:
            self.clients.remove(websocket)
            print(f"🔌 Client #{client_id} disconnected (remaining: {len(self.clients)})")
    
    async def broadcast_state(self):
        """Send updated state to all connected clients"""
        if self.clients:
            message = json.dumps({
                "type": "state_update",
                "data": self.tracker.get_state()
            })
            
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )
    
    async def start(self):
        """Start WebSocket server with keepalive"""
        async with websockets.serve(
            self.handler, 
            "localhost", 
            self.port,
            ping_interval=20,  # Send ping every 20 seconds
            ping_timeout=60    # Wait 60 seconds for pong before closing
        ):
            print(f"🌐 WebSocket server running on ws://localhost:{self.port}")
            print(f"⏱️  Keepalive: ping every 20s, timeout 60s")
            await asyncio.Future()  # Run forever


async def main():
    """Main entry point"""
    import sys
    
    # Load agenda file if provided
    agenda_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not agenda_file:
        print("⚠️ No agenda file provided. Usage: python agenda_tracker.py <agenda.json>")
        print("📝 Creating example agenda file: example_agenda.json")
        
        example_agenda = {
            "meetingTitle": "Product Sprint Planning",
            "items": [
                {
                    "id": "item_1",
                    "title": "Review Last Sprint",
                    "description": "Discuss completed tasks and blockers",
                    "keywords": ["sprint", "review", "completed", "blockers", "retrospective"],
                    "estimatedMinutes": 10
                },
                {
                    "id": "item_2",
                    "title": "Budget Allocation",
                    "description": "Discuss budget for next quarter",
                    "keywords": ["budget", "funding", "cost", "resources", "financial"],
                    "estimatedMinutes": 15
                },
                {
                    "id": "item_3",
                    "title": "Timeline & Deadlines",
                    "description": "Set milestones and delivery dates",
                    "keywords": ["timeline", "deadline", "milestone", "schedule", "delivery"],
                    "estimatedMinutes": 10
                }
            ]
        }
        
        with open("example_agenda.json", "w") as f:
            json.dump(example_agenda, f, indent=2)
        
        agenda_file = "example_agenda.json"
    
    # Initialize tracker
    tracker = AgendaTracker(agenda_file)
    
    # Start WebSocket server
    server = AgendaWebSocketServer(tracker)
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
