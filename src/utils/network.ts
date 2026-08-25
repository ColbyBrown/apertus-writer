// Network status detection utility for apertus-writer
// Detects online/offline state and provides helper functions

type NetworkStatus = 'online' | 'offline';

/**
 * Check current network status by attempting a silent fetch
 */
export async function checkNetworkStatus(): Promise<NetworkStatus> {
  try {
    // Try to connect to a known-safe endpoint for detection
    await fetch('/', { method: 'HEAD', timeout: 2000 });
    return 'online';
  } catch {
    return 'offline';
  }
}

/**
 * Quick check if currently online
 */
export function isOnline(): boolean {
  return checkNetworkStatus() === 'online';
}

/**
 * Get current network state (with Electron bridge fallback)
 */
export async function getNetworkState(): Promise<NetworkStatus> {
  // Try Electron bridge first (more reliable on desktop)
  if (window.require && typeof window !== 'undefined') {
    try {
      const BrowserWindow = require('electron').BrowserWindow;
      const win = BrowserWindow.getAllWindows()[0];
      if (win?.getWebContents()?.getLastKnownNetworkState) {
        const state = win.getWebContents().getLastKnownNetworkState();
        return state === 'online' ? 'online' : 'offline';
      }
    } catch {
      // Bridge unavailable, fall through to fetch check
    }
  }

  // Fallback: use fetch-based detection
  try {
    await fetch('/', { method: 'HEAD', timeout: 2000 });
    return 'online';
  } catch {
    return 'offline';
  }
}

/**
 * Debounced network status tracker to avoid rapid flickering
 */
let currentStatus: NetworkStatus = 'unknown';
let isTransitioning = false;

export function getNetworkStatus(): NetworkStatus {
  return currentStatus;
}

function updateStatus(newStatus: NetworkStatus) {
  // Only update if actually changing and not already transitioning
  if (currentStatus !== newStatus && !isTransitioning) {
    isTransitioning = true;
    currentStatus = newStatus;
    
    // Dispatch events for listeners
    if (newStatus === 'online') {
      window.dispatchEvent(new Event('re-online'));
    } else {
      window.dispatchEvent(new Event('offline'));
    }
    
    setTimeout(() => {
      isTransitioning = false;
    }, 2000); // Stop transitioning after 2 seconds
  }
}

window.addEventListener('online', () => updateStatus('online'));
window.addEventListener('offline', () => updateStatus('offline'));
