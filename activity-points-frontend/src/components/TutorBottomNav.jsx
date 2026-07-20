import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileUp, ListChecks, BookOpen, MessageSquare } from 'lucide-react';

const navItems = [
  { id: 'students', icon: Users, label: 'Students', path: '/tutor/dashboard/students' },
  { id: 'upload', icon: FileUp, label: 'Add Students', path: '/tutor/dashboard/upload' },
  { id: 'pending', icon: ListChecks, label: 'Pending Certificates', path: '/tutor/dashboard/pending' },
  { id: 'approved', icon: BookOpen, label: 'Approved Certificates', path: '/tutor/dashboard/approved' },
  { id: 'tickets', icon: MessageSquare, label: 'Tickets', path: '/tutor/dashboard/tickets' },
];

export default function TutorBottomNav({ activeTab, pendingCount = 0, ticketUnreadCount = 0 }) {
  const navigate = useNavigate();

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
            {id === 'tickets' && ticketUnreadCount > 0 && (
              <span className="tutor-nav-badge" aria-label={`${ticketUnreadCount} unread tickets`}>
                {ticketUnreadCount > 99 ? '99+' : ticketUnreadCount}
              </span>
            )}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
