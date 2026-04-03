#!/bin/bash
# Install Ghostline Native Messaging Host for macOS/Linux

echo "Installing Ghostline Native Messaging Host..."
echo ""

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Determine OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
    # Linux
    MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

# Create directory if it doesn't exist
mkdir -p "$MANIFEST_DIR"

# Create manifest file
MANIFEST_FILE="$MANIFEST_DIR/com.ghostline.bridge.json"

echo "Creating manifest file..."
cat > "$MANIFEST_FILE" << EOF
{
  "name": "com.ghostline.bridge",
  "description": "Ghostline CoDrone Bridge",
  "path": "$SCRIPT_DIR/ghostline_bridge",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_HERE/"
  ]
}
EOF

# Make the Python script executable
chmod +x "$SCRIPT_DIR/ghostline_bridge.py"

# Create wrapper script
cat > "$SCRIPT_DIR/ghostline_bridge" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
python3 "$SCRIPT_DIR/ghostline_bridge.py" "$@"
EOF

chmod +x "$SCRIPT_DIR/ghostline_bridge"

echo ""
echo "✓ Installation successful!"
echo ""
echo "IMPORTANT: You need to update the manifest file with your extension ID:"
echo "1. Load the extension in Chrome"
echo "2. Copy the extension ID from chrome://extensions"
echo "3. Edit: $MANIFEST_FILE"
echo "4. Replace EXTENSION_ID_HERE with your actual extension ID"
echo ""
