import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MoreVertical, User, LogOut, X, Bell } from 'lucide-react';
import TutorBottomNav from '../components/TutorBottomNav';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PasswordSetupPrompt from '../components/PasswordSetupPrompt';
import NotificationPermissionBanner from '../components/NotificationPermissionBanner';
import { listenForForegroundMessages, syncPushToken } from '../utils/pushNotifications';
import tutorAxios from '../api/tutorAxios';
import { getTutorTicketUnreadCount, getTutorTicketNewCount, getTutorTicketNotifications } from '../utils/ticketApi';
import '../css/TutorDashboard.css';

const PAGE_TITLES = {
  students: 'Students',
  upload: 'Add Students',
  pending: 'Pending Certificates',
  approved: 'Approved Certificates',
  tickets: 'Tickets',
  profile: 'Profile',
};

const TutorDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const path = location.pathname.split('/').pop(); // get last part of URL

  // Determine active tab
  const activeTab = React.useMemo(() => {
    return ['students', 'upload', 'pending', 'approved', 'tickets'].includes(path)
      ? path
      : 'students';
  }, [path]);

  // Page title shown in the fixed top bar; falls back to the active tab's
  // label for nested routes like students/:studentId.
  const pageTitle = PAGE_TITLES[path] || PAGE_TITLES[activeTab] || 'Dashboard';

  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarEnlarged, setAvatarEnlarged] = useState(false);

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
    syncPushToken('tutor');
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

  // Get tutor name from localStorage (instant paint; refined below once /tutors/me resolves)
  const [tutorName, setTutorName] = useState(localStorage.getItem('tutorName') || 'Tutor');
  const [tutorPhoto, setTutorPhoto] = useState(null);
  const [tutorRole, setTutorRole] = useState(localStorage.getItem('tutorRole') || 'tutor');

  // Whether the tutor is still on their original admin-set password.
  // Starts from the flag stashed at login (instant paint), refined once
  // /tutors/me resolves below.
  const [firstTimePasswordSet, setFirstTimePasswordSet] = useState(() => {
    const stored = localStorage.getItem('tutorFirstTimePasswordSet');
    return stored === null ? null : stored === 'true';
  });

  // Count of pending certificates, shown as a WhatsApp-style badge on the
  // "Pending Certificates" nav icon. Fetched independently of the Pending
  // Certificates page itself (so the badge stays accurate even when the
  // tutor is on a different tab), and refreshed on a light poll. The
  // PendingCertificates page also calls refreshPendingCount() (passed down
  // via Outlet context) right after an approve/reject/reassign so the
  // badge updates instantly instead of waiting for the next poll.
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = React.useCallback(() => {
    tutorAxios
      .get('/tutors/certificates/pending')
      .then(res => setPendingCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 30000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // Count of resolved-and-unseen tickets (own requests + forwarded student
  // tickets), shown as a badge on the "Tickets" nav icon — same pattern as
  // pendingCount above.
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);

  const refreshTicketUnreadCount = React.useCallback(() => {
    getTutorTicketUnreadCount()
      .then(res => setTicketUnreadCount(res.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshTicketUnreadCount();
    const interval = setInterval(refreshTicketUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [refreshTicketUnreadCount]);

  // Bell-icon notifications for brand-new tickets a student has just
  // raised into this tutor's inbox — same pattern as the admin panel's
  // bell, one step earlier in the chain (arrival, not resolution).
  const [newTicketCount, setNewTicketCount] = useState(0);
  const [ticketNotifications, setTicketNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const refreshNewTicketCount = React.useCallback(() => {
    getTutorTicketNewCount()
      .then(res => setNewTicketCount(res.data?.count || 0))
      .catch(() => {});
    getTutorTicketNotifications()
      .then(res => setTicketNotifications(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNewTicketCount();
    const interval = setInterval(refreshNewTicketCount, 20000);
    return () => clearInterval(interval);
  }, [refreshNewTicketCount]);

  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  // Jump straight to the ticket a notification was about: navigate to the
  // Tickets page carrying the id in router state, so TutorTickets can
  // auto-expand/scroll to it and mark it seen once it loads.
  const goToTicketFromNotification = (ticketId) => {
    setNotifOpen(false);
    setTicketNotifications(prev => prev.filter(t => t._id !== ticketId));
    setNewTicketCount(prev => Math.max(0, prev - 1));
    navigate('/tutor/dashboard/tickets', { state: { focusTicketId: ticketId } });
  };

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
        if (typeof res.data?.firstTimePasswordSet === 'boolean') {
          setFirstTimePasswordSet(res.data.firstTimePasswordSet);
          localStorage.setItem('tutorFirstTimePasswordSet', String(res.data.firstTimePasswordSet));
        }
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
      localStorage.removeItem('tutorFirstTimePasswordSet');
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
          onClick={() => setAvatarEnlarged(true)}
          aria-label="View profile photo"
          type="button"
        >
          {tutorPhoto ? (
            <img src={tutorPhoto} alt={tutorName} />
          ) : (
            <span>{avatarInitials}</span>
          )}
        </button>

        <span className="tutor-topbar-page-title">{pageTitle}</span>

        <div className="tutor-topbar-notif" ref={notifRef}>
          <button
            className="tutor-topbar-notif-btn"
            onClick={() => setNotifOpen(o => !o)}
            aria-label={newTicketCount > 0 ? `${newTicketCount} new tickets` : 'Notifications'}
            aria-haspopup="true"
            aria-expanded={notifOpen}
            type="button"
          >
            <Bell size={20} />
            {newTicketCount > 0 && (
              <span className="tutor-topbar-notif-badge">{newTicketCount > 99 ? '99+' : newTicketCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="tutor-topbar-dropdown tutor-notif-dropdown" role="menu">
              <div className="tutor-notif-dropdown-header">New Tickets</div>
              {ticketNotifications.length === 0 ? (
                <div className="tutor-notif-empty">No new tickets right now.</div>
              ) : (
                ticketNotifications.map(n => (
                  <button
                    key={n._id}
                    role="menuitem"
                    type="button"
                    className="tutor-notif-item"
                    onClick={() => goToTicketFromNotification(n._id)}
                  >
                    <span className="tutor-notif-item-subject">{n.subject}</span>
                    <span className="tutor-notif-item-meta">{n.raisedByName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

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
              <div className="tutor-topbar-dropdown-divider" role="separator" />
              <ThemeSwitcher />
              <div className="tutor-topbar-dropdown-divider" role="separator" />
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

      {/* Nested pages */}
      <main className="nested-content min-h-[300px]">
        <NotificationPermissionBanner role="tutor" />
        <React.Suspense fallback={<p className="loading-text">Loading...</p>}>
          <Outlet context={{ refreshPendingCount, refreshTicketUnreadCount, refreshNewTicketCount }} />
        </React.Suspense>
      </main>

      {/* Bottom navigation */}
      <TutorBottomNav
        activeTab={activeTab}
        pendingCount={pendingCount}
        ticketUnreadCount={ticketUnreadCount + newTicketCount}
      />

      {/* First-login nudge to change the admin-set password — auto-hides once firstTimePasswordSet flips to true */}
      <PasswordSetupPrompt show={firstTimePasswordSet === false} resetPath="/tutor/forgot-password" />

      {/* Tap-to-enlarge avatar preview, WhatsApp-style */}
      {avatarEnlarged && (
        <div
          className="tutor-avatar-lightbox"
          onClick={() => setAvatarEnlarged(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo preview"
        >
          <button
            className="tutor-avatar-lightbox-close"
            onClick={() => setAvatarEnlarged(false)}
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>
          <div className="tutor-avatar-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {tutorPhoto ? (
              <img src={tutorPhoto} alt={tutorName} />
            ) : (
              <span className="tutor-avatar-fallback-lg">{avatarInitials}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorDashboard;
