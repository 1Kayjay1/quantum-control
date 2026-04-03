// Content script injected into Ghostline web app
// Bridges between web app and extension background

console.log('Ghostline Extension: Content script loaded');

// Create a custom event system for web app communication
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.origin !== 'https://quantum-control.web.app') {
    return;
  }
  
  if (event.data.type === 'ghostline-command') {
    // Forward command to background script
    chrome.runtime.sendMessage({
      type: 'send-command',
      data: event.data.command
    }, (response) => {
      // Send response back to web app
      window.postMessage({
        type: 'ghostline-response',
        requestId: event.data.requestId,
        response: response
      }, 'https://quantum-control.web.app');
    });
  }
  
  if (event.data.type === 'ghostline-get-status') {
    chrome.runtime.sendMessage({
      type: 'get-status'
    }, (response) => {
      window.postMessage({
        type: 'ghostline-status',
        status: response
      }, 'https://quantum-control.web.app');
    });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'native-message') {
    // Forward to web app
    window.postMessage({
      type: 'ghostline-native-message',
      data: message.data
    }, 'https://quantum-control.web.app');
  }
});

// Inject a script to make extension available to web app
const script = document.createElement('script');
script.textContent = `
  (function() {
    console.log('Ghostline Extension: Bridge injected');
    
    // Create a global API for the web app
    window.ghostlineExtension = {
      available: true,
      
      sendCommand: function(command) {
        return new Promise((resolve) => {
          const requestId = Math.random().toString(36).substring(7);
          
          const handler = (event) => {
            if (event.data.type === 'ghostline-response' && event.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(event.data.response);
            }
          };
          
          window.addEventListener('message', handler);
          
          window.postMessage({
            type: 'ghostline-command',
            requestId: requestId,
            command: command
          }, 'https://quantum-control.web.app');
        });
      },
      
      getStatus: function() {
        return new Promise((resolve) => {
          const handler = (event) => {
            if (event.data.type === 'ghostline-status') {
              window.removeEventListener('message', handler);
              resolve(event.data.status);
            }
          };
          
          window.addEventListener('message', handler);
          
          window.postMessage({
            type: 'ghostline-get-status'
          }, 'https://quantum-control.web.app');
        });
      },
      
      onMessage: function(callback) {
        window.addEventListener('message', (event) => {
          if (event.data.type === 'ghostline-native-message') {
            callback(event.data.data);
          }
        });
      }
    };
    
    // Dispatch event to notify web app
    window.dispatchEvent(new CustomEvent('ghostline-extension-ready'));
  })();
`;
document.documentElement.appendChild(script);
script.remove();
