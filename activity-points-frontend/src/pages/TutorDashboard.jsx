import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreVertical, User, LogOut, X, Bell, RefreshCw, Palette, MessageSquare } from 'lucide-react';
import TutorBottomNav from '../components/TutorBottomNav';
import useSwipeNavigation from '../hooks/useSwipeNavigation';
import PasswordSetupPrompt from '../components/PasswordSetupPrompt';
import NotificationPermissionBanner from '../components/NotificationPermissionBanner';
import InstallAppBanner from '../components/InstallAppBanner';
import OfflineBanner from '../components/OfflineBanner';
import { listenForForegroundMessages, syncPushToken, unregisterPushNotifications, showForegroundNotification } from '../utils/pushNotifications';
import tutorAxios from '../api/tutorAxios';
import { getTutorTicketUnreadCount, getTutorTicketNewCount, getTutorTicketNotifications } from '../utils/ticketApi';
import { clearAllOfflineCaches } from '../utils/pageDataCache';
import { TutorTabProvider } from '../context/TutorTabContext';
import { noImgCallout } from '../utils/noImgCallout';
import StudentList from './StudentList';
import ProfileCompletionRing from '../components/ProfileCompletionRing';
import UploadCSV from './UploadCSV';
import PendingCertificates from './PendingCertificates';
import ApprovedCertificates from './ApprovedCertificates';
import '../css/TutorDashboard.css';

// The four swipeable tabs, mounted directly (side by side, in a
// horizontal track) instead of one-at-a-time through react-router's
// <Outlet/> — same treatment as StudentLayout's SWIPE_TABS. This is what
// lets a partial drag reveal a sliver of the neighboring tab, like
// WhatsApp's chat-list/status/calls pager. Order matches TutorBottomNav's
// navItems exactly. Tickets/Profile/Appearance (and the students/:id
// drill-down) aren't in this list, so they keep rendering through the
// plain <Outlet/> branch below, non-swipeable, same as Profile does for
// students.
const SWIPE_TABS = [
  { path: '/tutor/dashboard/students', Component: StudentList },
  { path: '/tutor/dashboard/upload', Component: UploadCSV },
  { path: '/tutor/dashboard/pending', Component: PendingCertificates },
  { path: '/tutor/dashboard/approved', Component: ApprovedCertificates },
];

const PAGE_TITLES = {
  students: 'Students',
  upload: 'Add Students',
  pending: 'Pending Certificates',
  approved: 'Approved Certificates',
  tickets: 'Help & Support',
  profile: 'Profile',
};

// Slide direction is based on tab order, not the browser's back/forward
// history — swiping/tapping "forward" through the tabs slides the new
// page in from the right, "backward" slides it in from the left. Same
// pattern as StudentLayout.
const pageVariants = {
  enter: (direction) => ({ x: direction >= 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction >= 0 ? '-100%' : '100%', opacity: 0 }),
};
const pageTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

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

  // Bottom-nav tab order — swiping left/right moves between these, same
  // as tapping the corresponding nav icon. Must match TutorBottomNav.jsx's
  // navItems.
  const SWIPE_TAB_PATHS = useMemo(() => SWIPE_TABS.map((t) => t.path), []);
  const { dragX, isDragging, currentIndex, swipeHandlers } = useSwipeNavigation(
    SWIPE_TAB_PATHS,
    location.pathname,
    (p) => navigate(p)
  );
  // -1 for routes nested under /tutor/dashboard that aren't one of the
  // four swipeable tabs (e.g. Tickets, Profile, a student's detail page)
  // — those still render through <Outlet/> as a single, non-swipeable page.
  const isSwipeTab = currentIndex !== -1;

  // Tracks which tab we were just on, so we know which direction to slide
  // toward for ANY navigation of the non-swipe (Outlet) route — bottom-nav
  // tap or otherwise.
  const prevTabIndexRef = useRef(currentIndex);
  const direction =
    currentIndex === -1 || prevTabIndexRef.current === -1
      ? 0
      : Math.sign(currentIndex - prevTabIndexRef.current);
  useEffect(() => {
    prevTabIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Pixel width of the swipeable viewport — measured (not assumed) so the
  // track lines up exactly regardless of device width. Re-measured on resize.
  const trackViewportRef = useRef(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useLayoutEffect(() => {
    const el = trackViewportRef.current;
    if (!el) return;
    const measure = () => setPaneWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarEnlarged, setAvatarEnlarged] = useState(false);

  // Pages cache their fetched data (see src/utils/pageDataCache.js) instead
  // of re-fetching every time they remount from a tab switch. Bumping
  // refreshToken is the signal each page listens for to bypass that cache
  // and pull fresh data — wired to the top-bar refresh button below, same
  // pattern as StudentLayout.
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const triggerRefresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  }, []);

  // Foreground push notifications (tab open + focused) — the service
  // worker only fires for background/closed-tab pushes, so this covers
  // the gap using the same browser Notification UI.
  useEffect(() => {
    const unsubscribe = listenForForegroundMessages(({ title, body, data }) => {
      // Click handling (focus/navigate to data.link) is done by the
      // service worker's shared `notificationclick` listener, same as
      // for background pushes — see firebase-messaging-sw.js.
      showForegroundNotification(title, body, data);
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
  const [tutorCompletion, setTutorCompletion] = useState(() => Number(localStorage.getItem('tutorCompletionPercent') || 25));

  // Whether the tutor is still on their original admin-set password.
  // Starts from the flag stashed at login (instant paint), refined once
  // /tutors/me resolves below.
  const [firstTimePasswordSet, setFirstTimePasswordSet] = useState(() => {
    const stored = localStorage.getItem('tutorFirstTimePasswordSet');
    return stored === null ? null : stored === 'true';
  });

  // Count of pending certificates, shown as a WhatsApp-style badge on the
  // "Pending Certificates" nav icon. Push notifications already alert the
  // tutor to new pending certs, so this isn't polled on a timer — it's
  // fetched once on app load and again whenever the top-bar refresh button
  // is tapped. The PendingCertificates page also calls refreshPendingCount()
  // (passed down via Outlet context) right after an approve/reject/reassign
  // so the badge updates instantly instead of waiting for a manual refresh.
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = React.useCallback(() => {
    tutorAxios
      .get('/tutors/certificates/pending')
      .then(res => setPendingCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount, refreshToken]);

  // Count of resolved-and-unseen tickets (own requests + forwarded student
  // tickets), shown as a badge on the "Tickets" nav icon — same
  // fetch-once-plus-refresh pattern as pendingCount above.
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);

  const refreshTicketUnreadCount = React.useCallback(() => {
    getTutorTicketUnreadCount()
      .then(res => setTicketUnreadCount(res.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshTicketUnreadCount();
  }, [refreshTicketUnreadCount, refreshToken]);

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
  }, [refreshNewTicketCount, refreshToken]);

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
        if (typeof res.data?.completionPercent === 'number') {
          setTutorCompletion(res.data.completionPercent);
          localStorage.setItem('tutorCompletionPercent', String(res.data.completionPercent));
        }
        if (res.data?.completionSteps) {
          localStorage.setItem('tutorCompletionSteps', JSON.stringify(res.data.completionSteps));
        }
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
  }, [refreshToken]);

  // Logout handler with confirmation
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      // Clear the server-side FCM token and this browser's Firebase token
      // before removing the JWT, so this device receives no pushes after
      // logout. A later login registers a fresh token again.
      await unregisterPushNotifications('tutor');
      localStorage.removeItem('tutorToken');
      localStorage.removeItem('tutorName');
      localStorage.removeItem('tutorFirstTimePasswordSet');
      clearAllOfflineCaches();
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
        <ProfileCompletionRing percent={tutorCompletion} size={46} className="compact">
          <button
            className="tutor-topbar-avatar"
            onClick={() => setAvatarEnlarged(true)}
            aria-label="View profile photo"
            type="button"
          >
            {tutorPhoto ? (
              <img src={tutorPhoto} alt={tutorName} className="no-img-callout" {...noImgCallout} />
            ) : (
              <span>{avatarInitials}</span>
            )}
          </button>
        </ProfileCompletionRing>

        <span className="tutor-topbar-page-title">{pageTitle}</span>

        <button
          className="tutor-topbar-refresh-btn"
          onClick={triggerRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          type="button"
        >
          <RefreshCw size={19} className={refreshing ? 'icon-spin' : ''} />
        </button>

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
              <div className="tutor-notif-dropdown-header">New Requests</div>
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
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/tutor/dashboard/tickets'); }}
                type="button"
              >
                <MessageSquare size={18} />
                <span>Help &amp; Support</span>
                {(ticketUnreadCount + newTicketCount) > 0 && (
                  <span className="tutor-topbar-dropdown-badge" aria-label={`${ticketUnreadCount + newTicketCount} ticket updates`}>
                    {(ticketUnreadCount + newTicketCount) > 99 ? '99+' : ticketUnreadCount + newTicketCount}
                  </span>
                )}
              </button>
              <div className="tutor-topbar-dropdown-divider" role="separator" />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/tutor/dashboard/appearance'); }}
                type="button"
              >
                <Palette size={18} />
                <span>Appearance</span>
              </button>
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

      {/* Nested tutor pages — a fixed pane between the top bar and bottom
          nav. The banners sit above the swipeable area (shown once, not
          per-tab), and the four swipe tabs (Students / Add Students /
          Pending / Approved — same order as TutorBottomNav) live in a
          horizontal track all four are mounted in simultaneously, so a
          partial drag reveals a sliver of the neighboring tab — like
          WhatsApp — rather than just animating whichever single route
          react-router has matched. Mirrors StudentLayout. */}
      <main
        className={`tutor-main${isDragging ? ' tutor-main-dragging' : ''}`}
        {...(isSwipeTab ? swipeHandlers : {})}
      >
        <div className="tutor-main-banners">
          <OfflineBanner />
          <NotificationPermissionBanner role="tutor" />
          <InstallAppBanner />
        </div>

        <div className="tutor-track-viewport" ref={trackViewportRef}>
          {isSwipeTab ? (
            <TutorTabProvider value={{ refreshPendingCount, refreshTicketUnreadCount, refreshNewTicketCount, refreshToken, triggerRefresh }}>
              <div
                className="tutor-track"
                style={{
                  width: paneWidth ? `${paneWidth * SWIPE_TABS.length}px` : '100%',
                  transform: `translateX(${-(currentIndex * paneWidth) + (isDragging ? dragX : 0)}px)`,
                  transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {SWIPE_TABS.map(({ path: tabPath, Component }) => (
                  <div
                    key={tabPath}
                    className="tutor-page-panel"
                    style={{ width: paneWidth ? `${paneWidth}px` : `${100 / SWIPE_TABS.length}%` }}
                  >
                    <div className="nested-content">
                      <React.Suspense fallback={<p className="loading-text">Loading...</p>}>
                        <Component />
                      </React.Suspense>
                    </div>
                  </div>
                ))}
              </div>
            </TutorTabProvider>
          ) : (
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={location.pathname}
                className="tutor-page-scroll"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={pageTransition}
              >
                <div className="nested-content">
                  <React.Suspense fallback={<p className="loading-text">Loading...</p>}>
                    <Outlet context={{ refreshPendingCount, refreshTicketUnreadCount, refreshNewTicketCount, refreshToken, triggerRefresh }} />
                  </React.Suspense>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Bottom navigation */}
      <TutorBottomNav
        activeTab={activeTab}
        pendingCount={pendingCount}
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
          <div
            className={`tutor-avatar-lightbox-content${tutorPhoto ? ' tutor-avatar-lightbox-content-photo' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {tutorPhoto ? (
              <img src={tutorPhoto} alt={tutorName} className="no-img-callout" {...noImgCallout} />
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
