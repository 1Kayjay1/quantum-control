# Ghostline Chrome Extension

Chrome extension that bridges the Ghostline web app to local CoDrone EDU hardware via native messaging.

## Features

- ✅ **No Electron Required** - Works with just Chrome/Edge
- ✅ **Portable Native Helper** - Small Python script, no installation
- ✅ **Automatic Backend** - Starts WebSocket server automatically
- ✅ **School-Friendly** - Works on computers that allow extensions
- ✅ **Zero Admin Rights** - User-level installation only

## For Users

### Installation

#### Step 1: Install Extension

1. Download the `ghostline-extension` folder
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `ghostline-extension` folder
6. Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

#### Step 2: Install Native Helper

**Windows:**
1. Open `native-host` folder
2. Double-click `install-windows.bat`
3. Edit `com.ghostline.bridge.json` and replace `EXTENSION_ID_HERE` with your actual extension ID
4. Copy backend files:
   - Copy `ghostline-backend/websocket_server.py` to `native-host/`
   - Copy `ghostline-backend/codrone_wrapper.py` to `native-host/`
   - Copy `ghostline-backend/requirements.txt` to `native-host/`
5. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

**macOS/Linux:**
1. Open terminal in `native-host` folder
2. Run: `chmod +x install-mac-linux.sh`
3. Run: `./install-mac-linux.sh`
4. Edit the manifest file (path shown in output) and replace `EXTENSION_ID_HERE`
5. Copy backend files (same as Windows)
6. Install dependencies: `pip3 install -r requirements.txt`

#### Step 3: Use Ghostline

1. Connect your CoDrone EDU via USB
2. Open: https://quantum-control.web.app/ghostline
3. Extension icon should show "Connected"
4. Start teaching!

### Troubleshooting

**Extension shows "Not connected"**
- Check that native helper is installed correctly
- Verify extension ID in manifest file matches actual ID
- Check logs: `%USERPROFILE%\.ghostline\native-host.log` (Windows) or `~/.ghostline/native-host.log` (Mac/Linux)

**"Native host has exited"**
- Make sure Python is installed
- Verify backend files are in `native-host/` folder
- Check that dependencies are installed

**CoDrone not connecting**
- Ensure drone is powered on
- Check USB cable
- Try: `python -c "from codrone_edu.drone import Drone; d = Drone(); d.pair()"`

## For Developers

### Development Setup

```bash
cd ghostline-extension
# No build step needed - it's pure JavaScript
```

### Testing

1. Load extension in Chrome (Developer mode)
2. Open: https://quantum-control.web.app/ghostline
3. Open DevTools → Console
4. Check for: "Ghostline Extension: Bridge injected"
5. Test: `window.ghostlineExtension.getStatus()`

### Architecture

```
Web App (quantum-control.web.app)
    ↕ window.postMessage
Content Script (content.js)
    ↕ chrome.runtime.sendMessage
Background Script (background.js)
    ↕ chrome.runtime.connectNative
Native Host (ghostline_bridge.py)
    ↕ subprocess
WebSocket Backend (websocket_server.py)
    ↕ WebSocket
CoDrone SDK (codrone_wrapper.py)
    ↕ USB/Bluetooth
CoDrone EDU Hardware
```

### Message Flow

1. **Web App → Extension:**
   ```javascript
   window.ghostlineExtension.sendCommand({
     command: 'connect',
     params: {}
   })
   ```

2. **Extension → Native Host:**
   ```json
   {
     "type": "start_backend"
   }
   ```

3. **Native Host → Backend:**
   Spawns `websocket_server.py` subprocess

4. **Backend → CoDrone:**
   Via `codrone_wrapper.py` SDK calls

### Web App Integration

The extension injects a global API into the web app:

```javascript
// Check if extension is available
if (window.ghostlineExtension?.available) {
  // Get connection status
  const status = await window.ghostlineExtension.getStatus();
  
  // Send command
  const result = await window.ghostlineExtension.sendCommand({
    command: 'connect',
    params: {}
  });
  
  // Listen for messages
  window.ghostlineExtension.onMessage((data) => {
    console.log('Message from drone:', data);
  });
}
```

### Building for Distribution

#### Create ZIP for Chrome Web Store

```bash
cd ghostline-extension
zip -r ghostline-extension.zip . -x "*.git*" -x "native-host/*" -x "README.md"
```

#### Package Native Helper

```bash
cd native-host
# Windows
zip -r ghostline-native-windows.zip . -x "*.log"

# macOS/Linux
tar -czf ghostline-native-unix.tar.gz . --exclude="*.log"
```

### Native Messaging Protocol

Messages are sent using Chrome's native messaging format:

**From Extension to Native Host:**
```json
{
  "type": "start_backend" | "stop_backend" | "get_status" | "ping"
}
```

**From Native Host to Extension:**
```json
{
  "type": "backend_started" | "backend_stopped" | "backend_log" | "status" | "error",
  "data": { ... }
}
```

## File Structure

```
ghostline-extension/
├── manifest.json           # Extension manifest
├── background.js           # Service worker
├── content.js              # Content script
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic
├── icons/                  # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── native-host/            # Native messaging host
    ├── ghostline_bridge.py # Python bridge
    ├── install-windows.bat # Windows installer
    ├── install-mac-linux.sh# Unix installer
    ├── websocket_server.py # Backend (copied)
    ├── codrone_wrapper.py  # SDK wrapper (copied)
    └── requirements.txt    # Python deps (copied)
```

## Comparison: Extension vs Desktop App

| Feature | Chrome Extension | Electron Desktop |
|---------|-----------------|------------------|
| Installation | Load unpacked | Extract and run |
| Admin Rights | No | No |
| File Size | ~50 KB | ~200 MB |
| Updates | Manual reload | Manual download |
| School Restrictions | Needs extensions allowed | Needs .exe allowed |
| Offline | Needs internet for web app | Needs internet for web app |
| Best For | Schools allowing extensions | Schools blocking extensions |

## Security Notes

- Extension only works on `quantum-control.web.app`
- Native host runs locally (no network access)
- CoDrone communication is local USB/Bluetooth only
- No data sent to external servers (except Firebase sync)

## License

Part of Quantum Control project.
