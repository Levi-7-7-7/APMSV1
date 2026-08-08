import { useEffect, useState } from 'react';

/**
 * Tracks navigator.onLine, updated live via the browser's 'online' /
 * 'offline' events. Used to gate actions that need the network (refresh,
 * submitting a certificate/ticket) while still letting the rest of the
 * app work fine off cached data when there's no connection.
 *
 * Note: navigator.onLine only reflects the device's network interface
 * (e.g. Wi-Fi/cellular connected at all), not whether the API server
 * itself is reachable — so it can't catch every failure mode, but it
 * correctly catches the common "phone is in airplane mode / has no
 * signal" case this is meant for.
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
