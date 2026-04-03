# Ghostline Deployment Guide

Complete guide for deploying Ghostline to school computers without admin rights.

## Overview

Ghostline has **two portable deployment options** designed for school environments with restricted permissions:

1. **Desktop App** - Standalone Electron application with embedded Python
2. **Chrome Extension** - Browser extension with native messaging helper

Both options require **zero admin rights** and work as extract-and-run solutions.

---

## Option 1: Desktop App (Recommended)

### When to Use
- ✅ School allows running .exe files from user folders
- ✅ Want simplest user experience
- ✅ Don't want to rely on browser extensions
- ✅ Need offline capability (except Firebase sync)

### Pros
- Single portable executable
- No browser dependencies
- Embedded Python runtime
- Auto-starts backend
- Professional desktop experience

### Cons
- Larger file size (~200 MB with Python)
- Separate download for each OS
- Manual updates required

### Build Instructions

#### Prerequisites
- Node.js 18+
- Python 3.11+
- npm packages installed

#### Step 1: Prepare Python Runtime

**Windows:**
```bash
cd ghostline-desktop

# Download Python Embeddable Package
# https://www.python.org/downloads/windows/
# Extract to: python-runtime/

# Install pip
python-runtime\python.exe get-pip.py

# Install dependencies
python-runtime\python.exe -m pip install -r ..\ghostline-backend\requirements.txt
```

**macOS:**
```bash
cd ghostline-desktop

# Create virtual environment
python3 -m venv python-runtime

# Install dependencies
python-runtime/bin/pip install -r ../ghostline-backend/requirements.txt
```

**Linux:**
```bash
cd ghostline-desktop

# Create virtual environment
python3 -m venv python-runtime

# Install dependencies
python-runtime/bin/pip install -r ../ghostline-backend/requirements.txt
```

#### Step 2: Install npm Dependencies

```bash
npm install
```

#### Step 3: Build

**Windows Portable:**
```bash
npm run build:win
```
Output: `dist/Ghostline-Portable.exe`

**macOS DMG:**
```bash
npm run build:mac
```
Output: `dist/Ghostline.dmg`

**Linux AppImage:**
```bash
npm run build:linux
```
Output: `dist/Ghostline.AppImage`

#### Step 4: Test

1. Copy the built executable to a USB drive
2. Plug into school computer
3. Run from USB (no installation)
4. Connect CoDrone EDU
5. Start teaching!

### Distribution

**For Students:**
1. Provide download link or USB drive with executable
2. Instructions: "Extract to any folder and double-click to run"
3. No installation wizard, no admin prompts

**File Sizes:**
- Windows: ~180 MB (includes Python runtime)
- macOS: ~200 MB
- Linux: ~190 MB

---

## Option 2: Chrome Extension

### When to Use
- ✅ School allows Chrome extensions (Developer mode)
- ✅ Want smallest file size
- ✅ Already using Chrome/Edge
- ✅ Can run small Python script

### Pros
- Tiny file size (~50 KB extension)
- Works in any Chrome/Edge browser
- Easy to update (reload extension)
- No executable files

### Cons
- Requires Developer mode for extensions
- Separate native helper installation
- Requires Python installed on system
- More setup steps

### Installation Instructions

#### Step 1: Install Extension

1. Download `ghostline-extension` folder
2. Open Chrome: `chrome://extensions`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select `ghostline-extension` folder
6. **Copy Extension ID** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

#### Step 2: Install Native Helper

**Windows:**
```bash
cd ghostline-extension/native-host

# Copy backend files
copy ..\..\ghostline-backend\*.py .
copy ..\..\ghostline-backend\requirements.txt .

# Install dependencies
pip install -r requirements.txt

# Run installer
install-windows.bat

# Edit manifest file (path shown in output)
# Replace EXTENSION_ID_HERE with your actual extension ID
```

**macOS/Linux:**
```bash
cd ghostline-extension/native-host

# Copy backend files
cp ../../ghostline-backend/*.py .
cp ../../ghostline-backend/requirements.txt .

# Install dependencies
pip3 install -r requirements.txt

# Run installer
chmod +x install-mac-linux.sh
./install-mac-linux.sh

# Edit manifest file (path shown in output)
# Replace EXTENSION_ID_HERE with your actual extension ID
```

#### Step 3: Verify Installation

1. Click extension icon in Chrome
2. Should show "✓ Connected to native helper"
3. Open: https://quantum-control.web.app/ghostline
4. Console should show: "Ghostline Extension: Bridge injected"

#### Step 4: Use Ghostline

1. Connect CoDrone EDU via USB
2. Navigate to Teach Mode
3. Click "Connect to Drone"
4. Start recording!

### Distribution

**For Students:**

**Package 1: Extension (ghostline-extension.zip)**
- Extension files
- Installation instructions

**Package 2: Native Helper (ghostline-native-helper.zip)**
- Python scripts
- Backend files
- Installation script
- requirements.txt

**Instructions:**
1. Install extension in Chrome
2. Extract native helper to any folder
3. Run installation script
4. Update manifest with extension ID

---

## Comparison Matrix

| Feature | Desktop App | Chrome Extension |
|---------|-------------|------------------|
| **File Size** | ~200 MB | ~50 KB + helper |
| **Installation** | Extract & run | Load extension + helper |
| **Admin Rights** | ❌ Not required | ❌ Not required |
| **Python Required** | ❌ Embedded | ✅ System Python |
| **Browser Required** | ❌ Standalone | ✅ Chrome/Edge |
| **Updates** | Manual download | Reload extension |
| **School Restrictions** | Needs .exe allowed | Needs extensions allowed |
| **Offline** | ✅ (except Firebase) | ✅ (except Firebase) |
| **Best For** | Most schools | Extension-friendly schools |

---

## School Environment Checklist

Before deploying, verify:

### Desktop App Requirements
- [ ] Can run .exe files from user folders (Windows)
- [ ] Can run apps from user folders (macOS/Linux)
- [ ] USB ports available for CoDrone
- [ ] Internet access for Firebase sync
- [ ] ~500 MB free disk space

### Chrome Extension Requirements
- [ ] Chrome/Edge browser available
- [ ] Developer mode can be enabled
- [ ] Python 3.8+ installed (or can be installed)
- [ ] Can run Python scripts
- [ ] USB ports available for CoDrone
- [ ] Internet access for Firebase sync

---

## Troubleshooting

### Desktop App Issues

**"App won't start"**
- Check if antivirus is blocking
- Try running from different folder
- Check logs in app data folder

**"Backend not starting"**
- Verify python-runtime folder exists
- Check backend files are included
- Look for error messages in console

**"CoDrone not connecting"**
- Ensure drone is powered on
- Check USB cable
- Try different USB port
- Windows: May need USB drivers

### Chrome Extension Issues

**"Extension not loading"**
- Verify Developer mode is enabled
- Check for errors in chrome://extensions
- Try reloading extension

**"Native host not connecting"**
- Verify installation script ran successfully
- Check extension ID in manifest matches
- Look at logs: `~/.ghostline/native-host.log`
- Verify Python dependencies installed

**"Backend not starting"**
- Check Python is in PATH
- Verify backend files copied to native-host/
- Check requirements.txt installed

---

## Testing Checklist

Before distributing to students:

### Desktop App
- [ ] Builds successfully
- [ ] Runs without installation
- [ ] Backend starts automatically
- [ ] Can connect to CoDrone
- [ ] Can record telemetry
- [ ] Saves to Firebase
- [ ] Works from USB drive
- [ ] Works on clean test machine

### Chrome Extension
- [ ] Extension loads in Chrome
- [ ] Native helper installs
- [ ] Extension connects to helper
- [ ] Backend starts automatically
- [ ] Can connect to CoDrone
- [ ] Can record telemetry
- [ ] Saves to Firebase
- [ ] Works on clean test machine

---

## Security Considerations

### Desktop App
- Loads web content from `quantum-control.web.app`
- Python backend runs locally (localhost:8765)
- No external network access except Firebase
- CoDrone communication is local USB/Bluetooth only
- No data collection or telemetry

### Chrome Extension
- Only works on `quantum-control.web.app` domain
- Native host runs locally (no network)
- Extension has minimal permissions
- No data sent to external servers
- All drone data stays local or in Firebase

---

## Support Resources

### Documentation
- Desktop App: `ghostline-desktop/README.md`
- Chrome Extension: `ghostline-extension/README.md`
- Backend: `ghostline-backend/README.md`
- Setup Guide: `GHOSTLINE_SETUP.md`

### Logs
- Desktop App: Check Electron console (Ctrl+Shift+I)
- Extension: `~/.ghostline/native-host.log`
- Backend: Console output

### Common Issues
- CoDrone SDK: https://docs.robolink.com/docs/codrone-edu/python/
- Firebase: Check firestore.rules
- WebSocket: Verify port 8765 not blocked

---

## Next Steps After Deployment

Once deployed and working:

1. **Save Recordings** ✅ - Already implemented
2. **Create Checkpoints** - UI for marking positions
3. **Replay Engine** - Execute recorded routes
4. **Optimization** - Iterative route improvement
5. **Visualization** - Telemetry plots and 3D paths

---

## License

Part of Quantum Control project.
