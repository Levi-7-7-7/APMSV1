/**
 * OfflineBanner — slim, non-dismissible status strip that appears
 * whenever the device has no connection, so it's always clear that
 * what's on screen is last-known/cached data rather than live data.
 *
 * Also flashes a brief "Back online" confirmation for a couple of
 * seconds when connectivity returns, then disappears on its own —
 * mirrors the pattern most chat/mail apps use, rather than the banner
 * just vanishing with no acknowledgement.
 *
 * Purely presentational; connectivity itself is tracked by
 * useOnlineStatus (see src/hooks/useOnlineStatus.js).
 *
 * Usage: drop it in the same banner stack as
 * NotificationPermissionBanner / InstallAppBanner, e.g.
 *   <OfflineBanner />
 *   <NotificationPermissionBanner role="student" />
 */
import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';
import '../css/OfflineBanner.css';

const RECONNECT_MESSAGE_MS = 2500;

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnected(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), RECONNECT_MESSAGE_MS);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`offline-banner${isOnline ? ' offline-banner-back' : ''}`} role="status">
      {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
      <span>{isOnline ? 'Back online' : "You're offline — showing saved data"}</span>
    </div>
  );
}
