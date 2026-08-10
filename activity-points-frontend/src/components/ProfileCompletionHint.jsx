import React from 'react';
import { Check, Circle } from 'lucide-react';
import '../css/ProfileCompletionHint.css';

export default function ProfileCompletionHint({ steps, tutor = false, admin = false }) {
  const items = admin
    ? [
        ['login', 'Log in'],
        ['photo', 'Upload your profile photo'],
        ['adminAction1', 'Complete any admin action'],
        ['adminAction2', 'Complete another admin action'],
      ]
    : tutor
    ? [
        ['login', 'Log in'],
        ['password', 'Set your own password'],
        ['firstStudent', 'Add/upload your first student'],
        ['certificateReview', 'Approve or reject a certificate'],
      ]
    : [
        ['login', 'Log in'],
        ['password', 'Set your own password'],
        ['photo', 'Upload your profile photo'],
        ['certificate', 'Upload your first certificate'],
      ];

  return (
    <div className="profile-completion-hint" aria-label="How to complete your profile">
      <div className="profile-completion-hint-title">Complete your profile</div>
      <div className="profile-completion-hint-subtitle">Each completed step adds 25%</div>
      <div className="profile-completion-hint-list">
        {items.map(([key, label]) => {
          const done = Boolean(steps?.[key]);
          return (
            <div className={`profile-completion-hint-item ${done ? 'done' : ''}`} key={key}>
              {done ? <Check size={13} strokeWidth={3} /> : <Circle size={10} />}
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
