import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { registerServiceWorkerForInstallability } from './utils/pushNotifications';
import { initAutoFullscreenOnFirstClick } from './utils/autoFullscreen';
import './css/theme.css';
import './css/CertModal.css';
import './css/modern.css';

// PC only: goes fullscreen (like F11) on the first click/keypress after the
// page loads. Browsers block auto-fullscreen on page load itself, so this
// is the closest real equivalent — see utils/autoFullscreen.js.
initAutoFullscreenOnFirstClick();

// Registers the SW immediately on load, decoupled from notification
// permission — this is what makes the app installable on Android/Chrome
// even before a user opts into push. See utils/pushNotifications.js.
registerServiceWorkerForInstallability();

// Handles notification clicks while a tab of the app is already open.
// The service worker (public/firebase-messaging-sw.js) posts this message
// instead of navigating the tab itself, because WindowClient.navigate()
// can silently no-op when the tab is already on the target URL. Doing the
// navigation here, from the page, with a plain window.location assignment
// always forces a real reload — even to the same URL — so the page is
// guaranteed to re-fetch fresh data from the backend every time.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_NAVIGATE' && event.data.link) {
      window.location.href = event.data.link;
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
