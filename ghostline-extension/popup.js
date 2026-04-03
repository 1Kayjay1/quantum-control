// Popup script for extension UI

const statusDiv = document.getElementById('status');
const statusText = document.getElementById('status-text');
const errorMessage = document.getElementById('error-message');
const reconnectBtn = document.getElementById('reconnect-btn');
const openAppBtn = document.getElementById('open-app-btn');

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'get-status' }, (response) => {
    if (!response) {
      statusDiv.className = 'status error';
      statusText.textContent = 'Extension error';
      return;
    }
    
    if (response.status === 'connected') {
      statusDiv.className = 'status connected';
      statusText.textContent = '✓ Connected to native helper';
      errorMessage.style.display = 'none';
    } else if (response.status === 'disconnected') {
      statusDiv.className = 'status disconnected';
      statusText.textContent = '✗ Not connected';
      if (response.error) {
        errorMessage.textContent = response.error;
        errorMessage.style.display = 'block';
      }
    } else {
      statusDiv.className = 'status error';
      statusText.textContent = '⚠ Connection error';
      if (response.error) {
        errorMessage.textContent = response.error;
        errorMessage.style.display = 'block';
      }
    }
  });
}

reconnectBtn.addEventListener('click', () => {
  reconnectBtn.disabled = true;
  reconnectBtn.textContent = 'Reconnecting...';
  
  chrome.runtime.sendMessage({ type: 'reconnect' }, () => {
    setTimeout(() => {
      reconnectBtn.disabled = false;
      reconnectBtn.textContent = 'Reconnect';
      updateStatus();
    }, 1000);
  });
});

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://quantum-control.web.app/ghostline' });
});

// Update status every 2 seconds
updateStatus();
setInterval(updateStatus, 2000);
