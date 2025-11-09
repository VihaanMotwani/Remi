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
            await asyncio.sleep(60)
    except:
        pass
    finally:
        clients.remove(ws)
        print("❌ Frontend disconnected")

async def broadcast_state(state: str):
    """Send state updates to all connected frontends"""
    data = {"state": state}
    dead = []
    for ws in clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)
