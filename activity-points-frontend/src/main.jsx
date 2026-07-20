import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { registerServiceWorkerForInstallability } from './utils/pushNotifications';
import './css/theme.css';
import './css/CertModal.css';

// Registers the SW immediately on load, decoupled from notification
// permission — this is what makes the app installable on Android/Chrome
// even before a user opts into push. See utils/pushNotifications.js.
registerServiceWorkerForInstallability();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
