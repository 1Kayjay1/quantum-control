#!/usr/bin/env python3
"""
Ghostline Native Messaging Host
Bridges Chrome extension to CoDrone EDU hardware via WebSocket backend
"""

import sys
import json
import struct
import subprocess
import os
import time
import threading
from pathlib import Path

# Native messaging protocol helpers
def send_message(message):
    """Send message to Chrome extension."""
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def read_message():
    """Read message from Chrome extension."""
    text_length_bytes = sys.stdin.buffer.read(4)
    if len(text_length_bytes) == 0:
        return None
    
    text_length = struct.unpack('I', text_length_bytes)[0]
    text = sys.stdin.buffer.read(text_length).decode('utf-8')
    return json.loads(text)

class GhostlineBridge:
    """Native messaging host for Ghostline."""
    
    def __init__(self):
        self.backend_process = None
        self.running = False
        
    def start_backend(self):
        """Start the Python WebSocket backend."""
        try:
            # Find the backend script
            script_dir = Path(__file__).parent
            backend_script = script_dir / 'websocket_server.py'
            
            if not backend_script.exists():
                send_message({
                    'type': 'error',
                    'error': f'Backend script not found: {backend_script}'
                })
                return False
            
            # Start the backend process
            self.backend_process = subprocess.Popen(
                [sys.executable, str(backend_script)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Monitor backend output in separate thread
            threading.Thread(target=self.monitor_backend, daemon=True).start()
            
            send_message({
                'type': 'backend_started',
                'pid': self.backend_process.pid
            })
            
            return True
            
        except Exception as e:
            send_message({
                'type': 'error',
                'error': f'Failed to start backend: {str(e)}'
            })
            return False
    
    def monitor_backend(self):
        """Monitor backend process output."""
        if not self.backend_process:
            return
        
        for line in self.backend_process.stdout:
            send_message({
                'type': 'backend_log',
                'message': line.strip()
            })
        
        # Process ended
        send_message({
            'type': 'backend_stopped',
            'code': self.backend_process.returncode
        })
    
    def stop_backend(self):
        """Stop the backend process."""
        if self.backend_process:
            self.backend_process.terminate()
            self.backend_process.wait(timeout=5)
            self.backend_process = None
    
    def handle_message(self, message):
        """Handle message from Chrome extension."""
        msg_type = message.get('type')
        
        if msg_type == 'start_backend':
            self.start_backend()
        
        elif msg_type == 'stop_backend':
            self.stop_backend()
            send_message({'type': 'backend_stopped'})
        
        elif msg_type == 'get_status':
            send_message({
                'type': 'status',
                'backend_running': self.backend_process is not None and self.backend_process.poll() is None
            })
        
        elif msg_type == 'ping':
            send_message({'type': 'pong'})
        
        else:
            send_message({
                'type': 'error',
                'error': f'Unknown message type: {msg_type}'
            })
    
    def run(self):
        """Main message loop."""
        self.running = True
        
        # Auto-start backend
        self.start_backend()
        
        try:
            while self.running:
                message = read_message()
                if message is None:
                    break
                
                self.handle_message(message)
        
        except KeyboardInterrupt:
            pass
        
        finally:
            self.stop_backend()

def main():
    """Entry point."""
    # Redirect stderr to a log file for debugging
    log_file = Path.home() / '.ghostline' / 'native-host.log'
    log_file.parent.mkdir(exist_ok=True)
    
    sys.stderr = open(log_file, 'a')
    print(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] Native host started', file=sys.stderr)
    
    bridge = GhostlineBridge()
    bridge.run()
    
    print(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] Native host stopped', file=sys.stderr)

if __name__ == '__main__':
    main()
