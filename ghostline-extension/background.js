// Background service worker for Ghostline Chrome Extension
// Manages native messaging connection to Python backend

let nativePort = null;
let connectionStatus = 'disconnected';
let lastError = null;

// Connect to native host
function connectNative() {
  console.log('Connecting to native host...');
  
  try {
    nativePort = chrome.runtime.connectNative('com.ghostline.bridge');
    
    nativePort.onMessage.addListener((message) => {
      console.log('Message from native:', message);
      
      // Broadcast to all content scripts
      chrome.tabs.query({ url: 'https://quantum-control.web.app/ghostline*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'native-message',
            data: message
          }).catch(() => {
            // Tab might not be ready yet
          });
        });
      });
    });
    
    nativePort.onDisconnect.addListener(() => {
      console.log('Native host disconnected');
      connectionStatus = 'disconnected';
      lastError = chrome.runtime.lastError?.message || 'Connection lost';
      nativePort = null;
      
      // Try to reconnect after 2 seconds
      setTimeout(connectNative, 2000);
    });
    
    connectionStatus = 'connected';
    lastError = null;
    console.log('Connected to native host');
    
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    connectionStatus = 'error';
    lastError = error.message;
    
    // Retry after 5 seconds
    setTimeout(connectNative, 5000);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-status') {
    sendResponse({
      status: connectionStatus,
      error: lastError
    });
    return true;
  }
  
  if (message.type === 'send-command') {
    if (nativePort) {
      nativePort.postMessage(message.data);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not connected to native host' });
    }
    return true;
  }
  
  if (message.type === 'reconnect') {
    if (nativePort) {
      nativePort.disconnect();
    }
    connectNative();
    sendResponse({ success: true });
    return true;
  }
});

// Start connection when extension loads
connectNative();

// Keep service worker alive
chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    console.log('Keepalive ping');
  }
});
