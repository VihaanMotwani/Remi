from fastapi import FastAPI, WebSocket
import asyncio

app = FastAPI()

clients = set()
current_state = "idle"  # track latest state for optional HTTP polling/fallback

@app.websocket("/ws/state")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("🔗 Frontend connected to Remi state channel")

    try:
        while True:  # Keep connection alive; could add ping/pong later
            await asyncio.sleep(60)
    except:
        pass
    finally:
        clients.remove(ws)
        print("❌ Frontend disconnected")


@app.get("/state")
async def get_state():
    """Optional REST endpoint if WebSocket not available."""
    return {"state": current_state}


# 🔸 Helper to broadcast states
async def broadcast_state(state: str):
    """Send state update to all connected frontends and persist latest."""
    global current_state
    current_state = state
    dead = []
    for ws in clients:
        try:
            await ws.send_json({"state": state})
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)
