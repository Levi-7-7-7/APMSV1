/**
 * pages/NotFound.jsx
 *
 * Catch-all for any URL that doesn't match a defined route. Previously
 * there was no wildcard route at all, so a stale bookmark, mistyped URL,
 * or an old deep-link from a notification would just render a blank
 * page — this gives the user somewhere to go instead.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import '../css/NotFound.css';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="nf-container">
      <div className="nf-icon"><Compass size={30} /></div>
      <h1 className="nf-code">404</h1>
      <h2 className="nf-title">Page not found</h2>
      <p className="nf-message">
        The page you're looking for doesn't exist, or you may not have access to it.
      </p>
      <div className="nf-actions">
        <button type="button" className="nf-btn secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Go back
        </button>
        <button type="button" className="nf-btn primary" onClick={() => navigate('/')}>
          Return home
        </button>
      </div>
    </div>
  );
}
