# core/server.py
from fastapi import FastAPI, WebSocket
import asyncio

app = FastAPI()  # ✅ must exist for uvicorn

clients = set()

@app.websocket("/ws/state")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("🔗 Frontend connected to Remi state channel")

    try:
        while True:
            await asyncio.sleep(60)  # keep-alive
    except Exception:
        pass
    finally:
        clients.remove(ws)
        print("❌ Frontend disconnected")

# helper used by mic_client/orchestrator
async def broadcast_state(state: str):
    """Send state update to all connected frontends."""
    dead = []
    for ws in clients:
        try:
            await ws.send_json({"state": state})
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)
    print(f"📡 Broadcasting state: {state} to {len(clients)} clients")

