/**
 * PasswordSetupPrompt — "set a new password" nudge shown on the dashboard
 * the first time a student/tutor logs in, until they actually change their
 * (system-assigned) password themselves via the Reset / Forgot Password flow.
 *
 * Driven entirely by the `firstTimePasswordSet` flag on the account:
 *   - false -> account is still on its original/admin-set password -> show
 *   - true  -> they've changed it at least once -> never shown again
 *
 * Dismissing ("Remind me later") only hides it for the current session/tab —
 * it reappears on the next login (or page reload) until the flag flips.
 *
 * Usage:
 *   <PasswordSetupPrompt show={firstTimePasswordSet === false} resetPath="/forgot-password" />
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import '../css/PasswordSetupPrompt.css';

export default function PasswordSetupPrompt({ show, resetPath }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      className="pwd-prompt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Set a new password"
    >
      <div className="pwd-prompt-card">
        <button
          className="pwd-prompt-close"
          onClick={() => setDismissed(true)}
          aria-label="Remind me later"
          type="button"
        >
          <X size={18} />
        </button>

        <div className="pwd-prompt-icon">
          <ShieldAlert size={28} />
        </div>

        <h3>Set a new password</h3>
        <p>
          You're still using your original system-assigned password. For your
          account's security, please set a personal password of your own.
        </p>

        <button
          className="pwd-prompt-btn"
          onClick={() => navigate(resetPath)}
          type="button"
        >
          Set New Password
        </button>
        <button
          className="pwd-prompt-later"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}
