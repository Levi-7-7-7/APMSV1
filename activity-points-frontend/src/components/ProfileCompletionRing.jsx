import React from 'react';
import '../css/ProfileCompletionRing.css';

/**
 * Profile completion ring.
 * Completion is four equal milestones: login 25%, personal password 50%,
 * profile photo 75%, first certificate 100%.
 */
export default function ProfileCompletionRing({ percent: explicitPercent, hasPhoto = false, size = 112, children, className = '' }) {
  const percent = typeof explicitPercent === 'number' ? Math.max(0, Math.min(100, explicitPercent)) : (hasPhoto ? 50 : 25);
  const stroke = Math.max(3, Math.round(size * 0.035));

  return (
    <div
      className={`profile-completion-ring ${className}`}
      style={{
        '--profile-ring-size': `${size}px`,
        '--profile-ring-stroke': `${stroke}px`,
        '--profile-ring-progress': `${percent * 3.6}deg`,
      }}
      title={`Profile ${percent}% complete`}
      aria-label={`Profile ${percent}% complete`}
    >
      <div className="profile-completion-ring-track" aria-hidden="true" />
      <div className="profile-completion-ring-progress" aria-hidden="true" />
      <div className="profile-completion-ring-content">
        {children}
      </div>
    </div>
  );
}
