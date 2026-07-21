import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, FileText, LayoutDashboard, MessageSquare } from 'lucide-react';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/student' },
  { id: 'upload',    icon: Upload,          label: 'Upload',    path: '/student/upload-certificate' },
  { id: 'certs',     icon: FileText,        label: 'My Certs',  path: '/student/certificates' },
  { id: 'tickets',   icon: MessageSquare,   label: 'Tickets',   path: '/student/tickets' },
];

export default function BottomNav({ ticketUnreadCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="student-bottom-nav">
      {navItems.map(({ id, icon: Icon, label, path }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={`student-nav-btn ${pathname === path ? 'active' : ''}`}
          type="button"
          aria-label={label}
        >
          <span className="student-nav-icon-wrap">
            <Icon size={24} />
            {id === 'tickets' && ticketUnreadCount > 0 && (
              <span className="student-nav-badge" aria-label={`${ticketUnreadCount} resolved tickets`}>
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
