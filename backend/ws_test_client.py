import asyncio
import websockets

async def main():
    uri = "ws://localhost:5050/ws/state"
    print(f"🔗 Connecting to {uri} ...")
    try:
        async with websockets.connect(uri) as ws:
            print("✅ Connected! Waiting for messages...\n")
            while True:
                msg = await ws.recv()
                print("📨 Received:", msg)
    except Exception as e:
        print("❌ Connection error:", e)

if __name__ == "__main__":
    asyncio.run(main())
