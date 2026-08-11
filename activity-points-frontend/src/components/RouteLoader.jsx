import React, { useEffect, useState } from 'react';
import '../css/RouteLoader.css';

// Suspense fallback shown while a lazy-loaded route chunk downloads. Most
// chunks are small and, once visited once, served from the browser cache —
// so rendering a spinner immediately would just flash on screen for a
// handful of milliseconds on every navigation. Instead this waits before
// showing anything, so it's invisible for fast/cached loads and only
// appears for genuinely slow ones (first visit to a page, slow connection).
const SHOW_DELAY_MS = 200;

export default function RouteLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="route-loader" role="status" aria-live="polite">
      <span className="route-loader-spinner" />
    </div>
  );
}
