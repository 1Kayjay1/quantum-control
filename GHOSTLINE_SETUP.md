# Ghostline Setup Guide

## What's Been Deployed

✅ **GitHub**: All code pushed to `variation-checkpoints-system` branch
✅ **Firebase**: Live at https://quantum-control.web.app/ghostline
✅ **Backend**: Python service ready in `ghostline-backend/` folder
✅ **Desktop App**: Portable Electron app in `ghostline-desktop/`
✅ **Chrome Extension**: Browser extension in `ghostline-extension/`

## Complete System Architecture

```
Web App (React) <--WebSocket--> Python Backend <--SDK--> CoDrone EDU
```

## Deployment Options for School Computers

### Option 1: Desktop App (Recommended for Most Schools)

**Best for:** Schools that block extensions but allow running .exe files

**Pros:**
- Single portable executable
- No browser required
- Embedded Python runtime
- Extract and run, no installation

**Setup:**
1. Download `Ghostline-Portable.exe` (Windows) or equivalent for your OS
2. Extract to any folder (USB drive, Documents, etc.)
3. Double-click to run
4. Connect CoDrone and start teaching!

**See:** `ghostline-desktop/README.md` for build instructions

### Option 2: Chrome Extension (Alternative)

**Best for:** Schools that allow Chrome extensions but restrict executables

**Pros:**
- Tiny file size (~50 KB)
- Works in any Chrome/Edge browser
- Easy to update
- No executable files

**Setup:**
1. Load extension in Chrome (Developer mode)
2. Install native helper (small Python script)
3. Open web app and connect drone

**See:** `ghostline-extension/README.md` for installation guide

### Option 3: Manual Backend (Development/Testing)

**Best for:** Development and testing on your own computer

## To Use Ghostline with Real Drone (Option 3 - Manual)

### 1. Install Python Backend

```bash
cd ghostline-backend
pip install -r requirements.txt
```

### 2. Connect CoDrone EDU

- Connect drone via USB or pair via Bluetooth
- Power on the drone

### 3. Start Backend Service

```bash
python websocket_server.py
```

You should see:
```
Starting Ghostline WebSocket server on localhost:8765
```

### 4. Open Web App

Go to: https://quantum-control.web.app/ghostline/workspace

- Create a workspace
- Create a session
- Click "Teach Mode"
- Click "Connect to Drone"
- Start recording and fly!

## Features Now Available

### Teach Mode
- ✅ Real-time connection status
- ✅ Battery monitoring
- ✅ Multiple teaching runs
- ✅ Full telemetry capture (20Hz)
- ✅ Joystick input recording
- ✅ Sensor data logging

### Data Captured Per Run
- Joystick positions (left/right X/Y)
- Button presses (L1, R1, etc.)
- Command values (roll, pitch, yaw, throttle)
- Sensor data (31 values):
  - Acceleration (X, Y, Z)
  - Gyro (X, Y, Z)
  - Angles (X, Y, Z)
  - Position (X, Y, Z from optical flow)
  - Front/bottom range sensors
  - Battery percentage
  - Movement state
  - Error state

## What Still Needs Implementation

- ⏳ Save recorded runs to Firebase
- ⏳ Checkpoint creation from recorded positions
- ⏳ Replay engine
- ⏳ Optimization algorithms
- ⏳ Safety monitoring layer
- ⏳ Telemetry visualization

## Troubleshooting

**"Backend service not running"**
- Make sure you ran `python websocket_server.py`
- Check that port 8765 is not blocked

**"Failed to connect to drone"**
- Ensure CoDrone is powered on
- Check USB cable or Bluetooth connection
- Try running: `python -c "from codrone_edu.drone import Drone; d = Drone(); d.pair()"`

**"Module not found: codrone_edu"**
- Run: `pip install codrone-edu>=2.5.0`

## Next Steps

The foundation is complete! To finish the system:

1. **Save Runs**: Connect recording to Firebase storage
2. **Checkpoints**: UI for creating checkpoints from recorded positions
3. **Replay**: Execute recorded routes autonomously
4. **Optimize**: Implement mutation strategies and elite memory
5. **Visualize**: Add telemetry plots and path visualization

## Files Structure

```
ghostline-backend/
├── codrone_wrapper.py      # CoDrone SDK wrapper
├── websocket_server.py     # WebSocket server
├── requirements.txt        # Python dependencies
└── README.md              # Backend documentation

src/ghostline/
├── services/
│   ├── ghostlineService.ts # Firebase CRUD
│   └── droneService.ts     # WebSocket client
├── types.ts               # Domain models
├── store.ts               # Zustand state
└── README.md              # Feature documentation
```

## Sleep Well! 🌙

Everything is committed and deployed. The backend is ready to connect to real hardware, and the frontend is live with full integration support!
