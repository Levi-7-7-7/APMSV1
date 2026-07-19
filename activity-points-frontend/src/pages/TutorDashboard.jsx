import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MoreVertical, User, LogOut } from 'lucide-react';
import TutorBottomNav from '../components/TutorBottomNav';
import tutorAxios from '../api/tutorAxios';
import '../css/TutorDashboard.css';

const ROLE_LABELS = { tutor: 'Tutor', hod: 'HOD', principal: 'Principal' };

const PAGE_TITLES = {
  students: 'Students',
  upload: 'Add Students',
  pending: 'Pending Certificates',
  approved: 'Approved Certificates',
  profile: 'Profile',
};

const TutorDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const path = location.pathname.split('/').pop(); // get last part of URL

  // Determine active tab
  const activeTab = React.useMemo(() => {
    return ['students', 'upload', 'pending', 'approved'].includes(path)
      ? path
      : 'students';
  }, [path]);

  // Page title shown in the fixed top bar; falls back to the active tab's
  // label for nested routes like students/:studentId.
  const pageTitle = PAGE_TITLES[path] || PAGE_TITLES[activeTab] || 'Dashboard';

  const [menuOpen, setMenuOpen] = useState(false);

  // Close the three-dot menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Get tutor name from localStorage (instant paint; refined below once /tutors/me resolves)
  const [tutorName, setTutorName] = useState(localStorage.getItem('tutorName') || 'Tutor');
  const [tutorPhoto, setTutorPhoto] = useState(null);
  const [tutorRole, setTutorRole] = useState(localStorage.getItem('tutorRole') || 'tutor');

  // Fetch the tutor's real profile (name + photo + role) so the header
  // matches what's shown on the full Profile page, instead of always
  // falling back to initials/stale role like before.
  useEffect(() => {
    let cancelled = false;

    tutorAxios
      .get('/tutors/me')
      .then(res => {
        if (cancelled) return;
        if (res.data?.name) {
          setTutorName(res.data.name);
          localStorage.setItem('tutorName', res.data.name);
        }
        setTutorPhoto(res.data?.profilePhoto ?? null);
        const role = res.data?.role || 'tutor';
        setTutorRole(role);
        localStorage.setItem('tutorRole', role);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Logout handler with confirmation
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('tutorToken');
      localStorage.removeItem('tutorName');
      navigate('/'); // redirect to login
    }
  };

  // Avatar initials (fallback when no photo is set)
  const avatarInitials = tutorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="tutor-dashboard">
      {/* Fixed WhatsApp-style top bar: stays put while everything else scrolls */}
      <header className="tutor-topbar">
        <button
          className="tutor-topbar-avatar"
          onClick={() => navigate('/tutor/dashboard/profile')}
          aria-label="View profile"
          type="button"
        >
          {tutorPhoto ? (
            <img src={tutorPhoto} alt={tutorName} />
          ) : (
            <span>{avatarInitials}</span>
          )}
        </button>

        <span className="tutor-topbar-title">{tutorName}</span>

        <span className="tutor-topbar-page-title">{pageTitle}</span>

        <div className="tutor-topbar-menu" ref={menuRef}>
          <button
            className="tutor-topbar-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            type="button"
          >
            <MoreVertical size={22} />
          </button>

          {menuOpen && (
            <div className="tutor-topbar-dropdown" role="menu">
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/tutor/dashboard/profile'); }}
                type="button"
              >
                <User size={18} />
                <span>Profile</span>
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                type="button"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Greeting */}
      <div className="tutor-greeting">
        <h1>
          Welcome, {tutorName}!{' '}
          <span className={`tutor-role-badge role-${tutorRole}`}>{ROLE_LABELS[tutorRole] || 'Tutor'}</span>
        </h1>
        <p>Manage students, CSV uploads, and certificates below.</p>
      </div>

      {/* Nested pages */}
      <main className="nested-content min-h-[300px]">
        <React.Suspense fallback={<p className="loading-text">Loading...</p>}>
          <Outlet />
        </React.Suspense>
      </main>

      {/* Bottom navigation */}
      <TutorBottomNav activeTab={activeTab} />
    </div>
  );
};

export default TutorDashboard;
