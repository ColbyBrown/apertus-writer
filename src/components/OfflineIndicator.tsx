import React, { useEffect, useState } from 'react';
import type { NetworkStatus } from '../../utils/network';

/**
 * Offline indicator component
 * Shows when the application is not connected to the internet
 */
interface OfflineIndicatorProps {
  position?: 'top-right' | 'bottom-left' | 'bottom-right';
  icon?: React.ReactNode;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top-right',
  icon = '🌐',
}) => {
  const [status, setStatus] = useState<NetworkStatus>('unknown');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    checkAndSetStatus();

    // Poll every 5 seconds
    const interval = setInterval(() => checkAndSetStatus(), 5000);

    // Listen for browser network events
    window.addEventListener('online', () => checkAndSetStatus());
    window.addEventListener('offline', () => checkAndSetStatus());

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    };
  }, []);

  const checkAndSetStatus = async () => {
    try {
      const isOnline = (await checkNetworkStatus()) === 'online';
      setStatus(isOnline ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  // Don't show when online
  if (status === 'online') return null;

  const positionClasses: Record<string, string> = {
    'top-right': 'offline-top-right',
    'bottom-left': 'offline-bottom-left',
    'bottom-right': 'offline-bottom-right',
  };

  // Get position-specific styles
  let style = {};
  if (position === 'top-right') {
    style = { top: '1rem', right: '1rem' };
  } else if (position === 'bottom-left') {
    style = { bottom: '0.5rem', left: '0.5rem' };
  } else if (position === 'bottom-right') {
    style = { bottom: '0.5rem', right: '1rem' };
  }

  return (
    <div 
      className="offline-indicator"
      style={style}
      role="status"
      aria-live="polite"
      title="You're currently working offline. Your changes are saved to local files."
    >
      {icon} <span>Working Offline</span>
    </div>
  );
};

/**
 * Helper: Check network status (moved here for component convenience)
 */
async function checkNetworkStatus(): Promise<boolean> {
  try {
    await fetch('/', { method: 'HEAD', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
