import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileUp, ListChecks, BookOpen } from 'lucide-react';

const navItems = [
  { id: 'students', icon: Users, label: 'Students', path: '/tutor/dashboard/students' },
  { id: 'upload', icon: FileUp, label: 'Add Students', path: '/tutor/dashboard/upload' },
  { id: 'pending', icon: ListChecks, label: 'Pending Certificates', path: '/tutor/dashboard/pending' },
  { id: 'approved', icon: BookOpen, label: 'Approved Certificates', path: '/tutor/dashboard/approved' },
];

// `progress` mirrors BottomNav's — a continuous 0..navItems.length-1 value
// fed from TutorDashboard's live drag position, so the indicator tracks a
// swipe in progress rather than only jumping once the route settles.
export default function TutorBottomNav({ activeTab, pendingCount = 0, progress, isDragging }) {
  const navigate = useNavigate();
  const hasIndicator = typeof progress === 'number';

  return (
    <div className="tutor-nav-sidebar">
      {navItems.map(({ id, icon: Icon, label, path }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={`tutor-nav-btn ${activeTab === id ? 'active' : ''}`}
          type="button"
        >
          <span className="tutor-nav-icon-wrap">
            <Icon size={24} />
            {id === 'pending' && pendingCount > 0 && (
              <span className="tutor-nav-badge" aria-label={`${pendingCount} pending certificates`}>
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </span>
          <span>{label}</span>
        </button>
      ))}
      {hasIndicator && (
        <span
          className={`tutor-nav-indicator${isDragging ? ' dragging' : ''}`}
          style={{ '--nav-count': navItems.length, '--nav-progress': progress }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
