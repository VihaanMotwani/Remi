from fastapi import FastAPI, WebSocket
import asyncio
app = FastAPI()

clients = set()

@app.websocket("/ws/state")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("🔗 Frontend connected to Remi state channel")

    try:
        while True:
            await asyncio.sleep(60)  # keep-alive
    except:
        pass
    finally:
        clients.remove(ws)
        print("❌ Frontend disconnected")


# 🔸 Helper to broadcast states
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
