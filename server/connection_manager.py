"""connection_manager.py"""

from fastapi import WebSocket

# --- WebSockets Connection Managers --- #


class ConnectionManager:
    def __init__(self):
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)

        print(f"Client Connected: ({len(self.clients)}) totals.")

    def disconnect(self, ws: WebSocket):
        if ws in self.clients:
            self.clients.remove(ws)

        print(f"Client disconnected ({len(self.clients)}) totals.")

    async def broadcast(self, message: dict):
        dead = []

        for ws in self.clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)
