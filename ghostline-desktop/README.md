# Ghostline Desktop App

Portable desktop application for Ghostline CoDrone EDU Route Optimizer with embedded Python runtime.

## Features

- ✅ **No Installation Required** - Extract and run, no admin rights needed
- ✅ **Embedded Python Runtime** - Python bundled inside, no separate installation
- ✅ **Automatic Backend** - WebSocket server starts automatically
- ✅ **Cross-Platform** - Windows, macOS, Linux support
- ✅ **Offline Capable** - Works without internet (except Firebase sync)

## For Users

### Windows (Portable)

1. Download `Ghostline-Portable.exe`
2. Double-click to run
3. No installation, no admin rights required
4. Connect your CoDrone EDU and start teaching!

### macOS

1. Download `Ghostline.dmg`
2. Open and drag to Applications (or run from anywhere)
3. First run: Right-click → Open (to bypass Gatekeeper)

### Linux

1. Download `Ghostline.AppImage`
2. Make executable: `chmod +x Ghostline.AppImage`
3. Run: `./Ghostline.AppImage`

## For Developers

### Development Setup

```bash
cd ghostline-desktop
npm install
```

### Run in Development

```bash
# Terminal 1: Start web app dev server
cd ..
npm run dev

# Terminal 2: Start Electron app
cd ghostline-desktop
npm start
```

The app will load from `http://localhost:5173/ghostline` and start the Python backend automatically.

### Build Portable Executables

#### Windows Portable (No Installer)

```bash
npm run build:win
```

Output: `dist/Ghostline-Portable.exe` (single executable, no installation)

#### macOS DMG

```bash
npm run build:mac
```

Output: `dist/Ghostline.dmg`

#### Linux AppImage

```bash
npm run build:linux
```

Output: `dist/Ghostline.AppImage`

### Embedding Python Runtime

The build process expects a `python-runtime/` folder with an embedded Python distribution:

#### Windows

1. Download Python Embeddable Package: https://www.python.org/downloads/windows/
2. Extract to `ghostline-desktop/python-runtime/`
3. Install pip: `python get-pip.py`
4. Install dependencies: `python -m pip install -r ../ghostline-backend/requirements.txt`

#### macOS/Linux

1. Use `pyenv` or download Python standalone build
2. Create virtual environment in `python-runtime/`
3. Install dependencies

### Build Script (Automated)

```bash
# Run the build preparation script
node scripts/prepare-build.js

# Then build
npm run build:win  # or build:mac, build:linux
```

## Architecture

```
Electron App
├── Main Process (main.js)
│   ├── Spawns Python backend
│   ├── Manages window lifecycle
│   └── IPC communication
├── Renderer Process (web app)
│   └── Loads from quantum-control.web.app/ghostline
└── Python Backend (embedded)
    ├── WebSocket server (port 8765)
    └── CoDrone SDK wrapper
```

## How It Works

1. **Electron starts** → Launches main.js
2. **Python backend spawns** → Starts websocket_server.py
3. **Web app loads** → From Firebase Hosting
4. **WebSocket connects** → localhost:8765
5. **Drone connects** → Via CoDrone SDK
6. **Teaching begins** → Real-time telemetry capture

## Troubleshooting

### "Backend not starting"

- Check console for Python errors
- Verify `python-runtime/` folder exists in production build
- Try: IPC → Restart Backend

### "CoDrone not connecting"

- Ensure drone is powered on
- Check USB cable or Bluetooth pairing
- Windows: May need USB drivers from Robolink

### "App won't start on macOS"

- Right-click → Open (first time only)
- Or: System Preferences → Security → Allow

### "Permission denied on Linux"

```bash
chmod +x Ghostline.AppImage
```

## File Structure

```
ghostline-desktop/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── package.json         # Build configuration
├── assets/              # Icons
│   ├── icon.png
│   ├── icon.ico         # Windows
│   └── icon.icns        # macOS
├── python-runtime/      # Embedded Python (not in git)
│   ├── python.exe       # Windows
│   ├── Lib/             # Python standard library
│   └── Scripts/         # pip, etc.
└── dist/                # Build output
    ├── Ghostline-Portable.exe
    ├── Ghostline.dmg
    └── Ghostline.AppImage
```

## Security Notes

- App loads web content from `quantum-control.web.app`
- Python backend runs locally (localhost:8765)
- No external network access except Firebase
- CoDrone communication is local USB/Bluetooth only

## License

Part of Quantum Control project.
