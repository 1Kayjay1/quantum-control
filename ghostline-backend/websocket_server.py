"""
WebSocket Server for Ghostline CoDrone Integration
Handles real-time communication between web app and CoDrone EDU
"""

import asyncio
import json
import websockets
from typing import Set, Dict, Any
from codrone_wrapper import CoDroneWrapper


class GhostlineServer:
    """WebSocket server for CoDrone communication."""
    
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.drone = CoDroneWrapper()
        self.telemetry_task = None
        self.telemetry_interval = 0.05  # 50ms = 20Hz
        
    async def register(self, websocket: websockets.WebSocketServerProtocol):
        """Register a new client connection."""
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")
        
        # Send initial connection state
        await self.send_to_client(websocket, {
            "type": "connection_state",
            "data": self.drone.get_connection_state()
        })
    
    async def unregister(self, websocket: websockets.WebSocketServerProtocol):
        """Unregister a client connection."""
        self.clients.remove(websocket)
        print(f"Client disconnected. Total clients: {len(self.clients)}")
        
        # If no clients, stop telemetry
        if len(self.clients) == 0 and self.telemetry_task:
            self.telemetry_task.cancel()
            self.telemetry_task = None
    
    async def send_to_client(self, websocket: websockets.WebSocketServerProtocol, message: Dict[str, Any]):
        """Send message to a specific client."""
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            pass
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients."""
        if self.clients:
            await asyncio.gather(
                *[self.send_to_client(client, message) for client in self.clients],
                return_exceptions=True
            )
    
    async def handle_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        """Handle incoming message from client."""
        try:
            data = json.loads(message)
            command = data.get("command")
            params = data.get("params", {})
            
            response = await self.execute_command(command, params)
            
            await self.send_to_client(websocket, {
                "type": "command_response",
                "command": command,
                "success": response.get("success", False),
                "data": response.get("data"),
                "error": response.get("error")
            })
            
        except json.JSONDecodeError:
            await self.send_to_client(websocket, {
                "type": "error",
                "error": "Invalid JSON"
            })
        except Exception as e:
            await self.send_to_client(websocket, {
                "type": "error",
                "error": str(e)
            })
    
    async def execute_command(self, command: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a drone command."""
        try:
            if command == "connect":
                success = self.drone.connect()
                if success:
                    # Start telemetry streaming
                    if not self.telemetry_task:
                        self.telemetry_task = asyncio.create_task(self.telemetry_loop())
                return {
                    "success": success,
                    "data": self.drone.get_connection_state()
                }
            
            elif command == "disconnect":
                success = self.drone.disconnect()
                if self.telemetry_task:
                    self.telemetry_task.cancel()
                    self.telemetry_task = None
                return {"success": success}
            
            elif command == "takeoff":
                success = self.drone.takeoff()
                return {"success": success}
            
            elif command == "land":
                success = self.drone.land()
                return {"success": success}
            
            elif command == "emergency_stop":
                success = self.drone.emergency_stop()
                return {"success": success}
            
            elif command == "hover":
                duration = params.get("duration", 1.0)
                success = self.drone.hover(duration)
                return {"success": success}
            
            elif command == "set_control":
                roll = params.get("roll", 0)
                pitch = params.get("pitch", 0)
                yaw = params.get("yaw", 0)
                throttle = params.get("throttle", 0)
                success = self.drone.set_control(roll, pitch, yaw, throttle)
                return {"success": success}
            
            elif command == "move":
                duration = params.get("duration")
                success = self.drone.move(duration)
                return {"success": success}
            
            elif command == "reset_move":
                success = self.drone.reset_move()
                return {"success": success}
            
            elif command == "start_recording":
                success = self.drone.start_recording()
                return {"success": success}
            
            elif command == "stop_recording":
                telemetry = self.drone.stop_recording()
                return {
                    "success": True,
                    "data": {"telemetry": telemetry}
                }
            
            elif command == "get_battery":
                battery = self.drone.get_battery()
                return {
                    "success": True,
                    "data": {"battery": battery}
                }
            
            elif command == "set_telemetry_interval":
                interval = params.get("interval", 50)
                self.telemetry_interval = interval / 1000.0  # Convert ms to seconds
                return {"success": True}
            
            else:
                return {
                    "success": False,
                    "error": f"Unknown command: {command}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def telemetry_loop(self):
        """Continuously stream telemetry data to clients."""
        try:
            while True:
                if self.drone.is_connected and len(self.clients) > 0:
                    # Capture telemetry sample
                    sample = self.drone.capture_telemetry_sample()
                    
                    # Broadcast to all clients
                    await self.broadcast({
                        "type": "telemetry",
                        "data": sample
                    })
                
                await asyncio.sleep(self.telemetry_interval)
                
        except asyncio.CancelledError:
            print("Telemetry loop cancelled")
    
    async def handler(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket connection."""
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)
    
    async def start(self):
        """Start the WebSocket server."""
        print(f"Starting Ghostline WebSocket server on {self.host}:{self.port}")
        async with websockets.serve(self.handler, self.host, self.port):
            await asyncio.Future()  # Run forever


def main():
    """Main entry point."""
    server = GhostlineServer(host="localhost", port=8765)
    asyncio.run(server.start())


if __name__ == "__main__":
    main()
