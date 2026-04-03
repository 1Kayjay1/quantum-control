# Ghostline Backend - CoDrone EDU Integration

Python backend service for connecting Ghostline web app to CoDrone EDU hardware.

## Requirements

- Python 3.8+
- CoDrone EDU (JROTC edition)
- USB cable or Bluetooth connection

## Installation

```bash
cd ghostline-backend
pip install -r requirements.txt
```

## Usage

1. Connect your CoDrone EDU via USB or Bluetooth
2. Start the WebSocket server:

```bash
python websocket_server.py
```

3. The server will run on `ws://localhost:8765`
4. Open the Ghostline web app and it will automatically connect

## Architecture

```
Web App (React) <--WebSocket--> Python Server <--SDK--> CoDrone EDU
```

### Components

- **codrone_wrapper.py** - Clean wrapper around CoDrone EDU SDK
- **websocket_server.py** - WebSocket server for real-time communication
- **requirements.txt** - Python dependencies

## WebSocket Protocol

### Client → Server (Commands)

```json
{
  "command": "connect",
  "params": {}
}
```

Available commands:
- `connect` - Connect to drone
- `disconnect` - Disconnect from drone
- `takeoff` - Execute takeoff
- `land` - Execute landing
- `emergency_stop` - Emergency stop
- `hover` - Hover in place
- `set_control` - Set roll/pitch/yaw/throttle
- `move` - Execute movement
- `reset_move` - Reset motion variables
- `start_recording` - Start telemetry recording
- `stop_recording` - Stop recording and get data
- `get_battery` - Get battery level
- `set_telemetry_interval` - Set telemetry rate (ms)

### Server → Client (Events)

**Connection State:**
```json
{
  "type": "connection_state",
  "data": {
    "drone": "connected",
    "controller": "connected",
    "lastHeartbeat": 1234567890,
    "errorMessage": null
  }
}
```

**Telemetry Stream (20Hz default):**
```json
{
  "type": "telemetry",
  "data": {
    "timestamp": 1234567890,
    "joystick": {"leftX": 0, "leftY": 0, "rightX": 0, "rightY": 0},
    "buttons": {"l1": false, "r1": false},
    "command": {"roll": 0, "pitch": 0, "yaw": 0, "throttle": 0},
    "sensor": {
      "accelX": 0, "accelY": 0, "accelZ": 0,
      "gyroX": 0, "gyroY": 0, "gyroZ": 0,
      "angleX": 0, "angleY": 0, "angleZ": 0,
      "x": 0, "y": 0, "z": 0,
      "frontRange": 0, "bottomRange": 0,
      "batteryPercent": 78
    },
    "position": {"time": 1234567890, "x": 0, "y": 0, "z": 0}
  }
}
```

**Command Response:**
```json
{
  "type": "command_response",
  "command": "takeoff",
  "success": true,
  "data": {},
  "error": null
}
```

## Development

### Testing Connection

```python
from codrone_wrapper import CoDroneWrapper

drone = CoDroneWrapper()
if drone.connect():
    print("Connected!")
    print(f"Battery: {drone.get_battery()}%")
    drone.disconnect()
```

### Running Server

```bash
python websocket_server.py
```

Server will log:
- Client connections/disconnections
- Commands received
- Errors

## Troubleshooting

**"Module not found: codrone_edu"**
- Install: `pip install codrone-edu`

**"Connection failed"**
- Check USB cable connection
- Ensure drone is powered on
- Try Bluetooth pairing first

**"Permission denied"**
- On Linux/Mac, may need: `sudo python websocket_server.py`
- Or add user to dialout group: `sudo usermod -a -G dialout $USER`

**WebSocket connection refused**
- Ensure server is running
- Check firewall settings
- Verify port 8765 is not in use

## SDK Version

Requires CoDrone EDU SDK >= 2.5.0 (fixes for `move_distance` and `send_absolute_position`)

## Notes

- Optical flow coordinate frame resets at takeoff/battery insert
- X/Y axes stay tied to takeoff heading (don't rotate with yaw)
- Range sensors work up to ~1.5m
- Use programming mat for best optical flow stability
- Controller screen drawing functions unavailable on JROTC edition
