import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, FileText, LayoutDashboard } from 'lucide-react';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/student' },
  { id: 'upload',    icon: Upload,          label: 'Upload',    path: '/student/upload-certificate' },
  { id: 'certs',     icon: FileText,        label: 'My Certs',  path: '/student/certificates' },
];

// `progress` is the fractional swipe-tab position from StudentLayout — an
// integer (0, 1, 2...) at rest, but a continuous value while a swipe is in
// progress (e.g. 0.4 partway from tab 0 to tab 1). Passing this through
// lets the little indicator bar below the icons chase the finger in real
// time during a drag, instead of only ever snapping once the route
// actually changes. `undefined` (not on a swipe tab, e.g. Profile) hides it.
export default function BottomNav({ progress, isDragging } = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hasIndicator = typeof progress === 'number';

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
          </span>
          <span>{label}</span>
        </button>
      ))}
      {hasIndicator && (
        // Position/size as CSS custom properties, not an inline transform —
        // this bar becomes a vertical left sidebar at desktop widths (see
        // StudentDashboard.css), so the axis the indicator slides along
        // has to flip too, which only the CSS media query can decide.
        <span
          className={`student-nav-indicator${isDragging ? ' dragging' : ''}`}
          style={{ '--nav-count': navItems.length, '--nav-progress': progress }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
