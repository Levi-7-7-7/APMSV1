import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MoreVertical, User, LogOut, X } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PasswordSetupPrompt from '../components/PasswordSetupPrompt';
import NotificationPermissionBanner from '../components/NotificationPermissionBanner';
import { listenForForegroundMessages, syncPushToken } from '../utils/pushNotifications';
import '../css/StudentDashboard.css';

const PAGE_TITLES = {
  '/student': 'Dashboard',
  '/student/upload-certificate': 'Upload Certificate',
  '/student/certificates': 'My Certificates',
  '/student/tickets': 'Tickets',
  '/student/profile': 'Profile',
};

const StudentLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  const [userName, setUserName] = useState(() => {
    // Try userData first (set after dashboard fetch), fall back to userName key
    const ud = localStorage.getItem('userData');
    if (ud) {
      try { return JSON.parse(ud).name || 'Student'; } catch (_) {}
    }
    return localStorage.getItem('userName') || 'Student';
  });

  const [profilePhoto, setProfilePhoto] = useState(() => {
    const ud = localStorage.getItem('userData');
    if (ud) {
      try { return JSON.parse(ud).profilePhoto || null; } catch (_) {}
    }
    return null;
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarEnlarged, setAvatarEnlarged] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Whether the student is still on their original system-assigned password.
  // Starts from the flag stashed at login (instant paint), refined once the
  // Dashboard's /students/me fetch resolves and writes fresh userData.
  const [firstTimePasswordSet, setFirstTimePasswordSet] = useState(() => {
    const stored = localStorage.getItem('firstTimePasswordSet');
    return stored === null ? null : stored === 'true';
  });

  // Foreground push notifications (tab open + focused) — the service
  // worker only fires for background/closed-tab pushes, so this covers
  // the gap using the same browser Notification UI.
  useEffect(() => {
    const unsubscribe = listenForForegroundMessages(({ title, body, data }) => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notif = new Notification(title, { body, icon: '/icon-192.png' });
        if (data?.link) {
          notif.onclick = () => {
            window.focus();
            navigate(data.link);
          };
        }
      }
    });
    return unsubscribe;
  }, [navigate]);

  // Covers every login, not just the very first: if this browser already
  // has notification permission granted (from an earlier session, or a
  // different account on a shared device), make sure the backend still
  // has a valid token for *this* account — the banner below only fires
  // once, on the very first grant, so this is what keeps re-logins and
  // pruned/expired tokens working without asking the user again.
  useEffect(() => {
    syncPushToken('student');
  }, []);

  // Re-read from localStorage whenever userData changes (e.g. after Dashboard fetch,
  // or after uploading a new photo on the Profile page)
  useEffect(() => {
    const sync = () => {
      const ud = localStorage.getItem('userData');
      if (ud) {
        try {
          const parsed = JSON.parse(ud);
          if (parsed?.name) setUserName(parsed.name);
          setProfilePhoto(parsed?.profilePhoto || null);
          if (typeof parsed?.firstTimePasswordSet === 'boolean') {
            setFirstTimePasswordSet(parsed.firstTimePasswordSet);
            localStorage.setItem('firstTimePasswordSet', String(parsed.firstTimePasswordSet));
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', sync);
    // Also poll once shortly after mount in case Dashboard sets it in the same tab
    const timer = setTimeout(sync, 800);
    return () => { window.removeEventListener('storage', sync); clearTimeout(timer); };
  }, []);

  // WhatsApp-style: the top bar stays fixed, but gains a subtle shadow once
  // the page underneath has scrolled, giving it a sense of "elevation".
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  // Close the enlarged avatar on Escape
  useEffect(() => {
    if (!avatarEnlarged) return;
    const onKey = (e) => { if (e.key === 'Escape') setAvatarEnlarged(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [avatarEnlarged]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('userName');
      localStorage.removeItem('firstTimePasswordSet');
      navigate('/');
    }
  };

  const avatarInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="student-dashboard">
      {/* Fixed WhatsApp-style top bar: stays put while everything else scrolls */}
      <header className={`app-topbar ${scrolled ? 'scrolled' : ''}`}>
        <button
          className="app-topbar-avatar"
          onClick={() => setAvatarEnlarged(true)}
          aria-label="View profile photo"
          type="button"
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt={userName} />
          ) : (
            <span className="avatar-fallback">{avatarInitials}</span>
          )}
        </button>

        <span className="app-topbar-page-title">{pageTitle}</span>

        <div className="app-topbar-menu" ref={menuRef}>
          <button
            className="app-topbar-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            type="button"
          >
            <MoreVertical size={22} />
          </button>

          {menuOpen && (
            <div className="app-topbar-dropdown" role="menu">
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/student/profile'); }}
                type="button"
              >
                <User size={18} />
                <span>Profile</span>
              </button>
              <div className="app-topbar-dropdown-divider" role="separator" />
              <ThemeSwitcher />
              <div className="app-topbar-dropdown-divider" role="separator" />
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

      {/* Nested student pages */}
      <main className="dashboard-main">
        <NotificationPermissionBanner role="student" />
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <BottomNav />

      {/* First-login nudge to change the default password — auto-hides once firstTimePasswordSet flips to true */}
      <PasswordSetupPrompt show={firstTimePasswordSet === false} resetPath="/forgot-password" />

      {/* Tap-to-enlarge avatar preview, WhatsApp-style */}
      {avatarEnlarged && (
        <div
          className="avatar-lightbox"
          onClick={() => setAvatarEnlarged(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo preview"
        >
          <button
            className="avatar-lightbox-close"
            onClick={() => setAvatarEnlarged(false)}
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>
          <div className="avatar-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {profilePhoto ? (
              <img src={profilePhoto} alt={userName} />
            ) : (
              <span className="avatar-fallback-lg">{avatarInitials}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLayout;
