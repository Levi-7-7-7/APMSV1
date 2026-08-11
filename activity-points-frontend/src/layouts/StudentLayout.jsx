import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreVertical, User, LogOut, X, RefreshCw, Palette, MessageSquare } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import useSwipeNavigation from '../hooks/useSwipeNavigation';
import useOnlineStatus from '../hooks/useOnlineStatus';
import PasswordSetupPrompt from '../components/PasswordSetupPrompt';
import ProfileCompletionRing from '../components/ProfileCompletionRing';
import NotificationPermissionBanner from '../components/NotificationPermissionBanner';
import InstallAppBanner from '../components/InstallAppBanner';
import OfflineBanner from '../components/OfflineBanner';
import { listenForForegroundMessages, syncPushToken, unregisterPushNotifications, showForegroundNotification } from '../utils/pushNotifications';
import { getStudentTicketUnreadCount } from '../utils/ticketApi';
import { clearAllOfflineCaches } from '../utils/pageDataCache';
import { StudentTabProvider } from '../context/StudentTabContext';
import Dashboard from '../pages/Dashboard';
import CertificateUploadScreen from '../pages/UploadCertificates';
import CertificatesPage from '../pages/CertificatesPage';
import { noImgCallout } from '../utils/noImgCallout';
import '../css/StudentDashboard.css';

// The three swipeable tabs, mounted directly (side by side, in a horizontal
// track) instead of one-at-a-time through react-router's <Outlet/>. This is
// what lets a partial drag reveal a sliver of the neighboring tab, like
// WhatsApp's chat-list/status/calls pager, instead of only animating the
// currently-matched route. Tickets used to be a fourth swipe tab but now
// lives behind the three-dot menu (see dropdown below) alongside Profile
// and Appearance, so it renders through the plain <Outlet/> branch instead.
const SWIPE_TABS = [
  { path: '/student', Component: Dashboard },
  { path: '/student/upload-certificate', Component: CertificateUploadScreen },
  { path: '/student/certificates', Component: CertificatesPage },
];

const PAGE_TITLES = {
  '/student': 'Dashboard',
  '/student/upload-certificate': 'Upload Certificate',
  '/student/certificates': 'My Certificates',
  '/student/tickets': 'Help & Support',
  '/student/profile': 'Profile',
};

// Slide direction is based on tab order, not the browser's back/forward
// history — swiping/tapping "forward" through the tabs slides the new page
// in from the right, "backward" slides it in from the left, matching how
// native tab bars (and iOS/Android nav) animate.
const pageVariants = {
  enter: (direction) => ({ x: direction >= 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction >= 0 ? '-100%' : '100%', opacity: 0 }),
};
const pageTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

const StudentLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  // Bottom-nav tab order — swiping left/right moves between these, same as
  // tapping the corresponding nav icon. Must match BottomNav.jsx's navItems.
  const SWIPE_TAB_PATHS = useMemo(() => SWIPE_TABS.map((t) => t.path), []);
  const { dragX, isDragging, currentIndex, swipeHandlers } = useSwipeNavigation(
    SWIPE_TAB_PATHS,
    location.pathname,
    (path) => navigate(path)
  );
  // -1 for routes nested under /student that aren't one of the four
  // swipeable tabs (e.g. Profile) — those still render through <Outlet/>
  // as a single, non-swipeable page.
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

  // Continuous 0..N-1 position for the bottom-nav indicator: the plain
  // tab index at rest, nudged by the live drag fraction mid-swipe (only
  // once paneWidth is known and there's actually somewhere to go — same
  // "resistance at the edges" the track itself already applies via dragX).
  const navIndicatorProgress = isSwipeTab
    ? currentIndex + (isDragging && paneWidth ? dragX / paneWidth : 0)
    : undefined;

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

  const [certificateCount, setCertificateCount] = useState(() => {
    const ud = localStorage.getItem('userData');
    if (ud) { try { return Number(JSON.parse(ud).certificateCount || 0); } catch (_) {} }
    return 0;
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
    syncPushToken('student');
  }, []);

  // Pages cache their fetched data (see src/utils/pageDataCache.js) instead
  // of re-fetching every time they remount from a swipe/tab change. Bumping
  // refreshToken is the signal each page listens for to bypass that cache
  // and pull fresh data — wired to the top-bar refresh button below.
  // All four tabs are mounted at once now, so a single refreshToken bump
  // fires ALL of their fetches at once, not just the visible one — which
  // is exactly why this needs an offline guard: without it, tapping
  // refresh while offline would fire four requests that all fail at once.
  const isOnline = useOnlineStatus();
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const triggerRefresh = useCallback(() => {
    if (!isOnline) {
      alert("You're offline. Connect to the internet to refresh.");
      return;
    }
    setRefreshToken((t) => t + 1);
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  }, [isOnline]);

  // "Ticket solved" badge on the Tickets item in the three-dot dropdown —
  // a resolved ticket the student hasn't opened yet. Push notifications
  // already tell the student the moment a ticket is resolved, so this isn't
  // polled on a timer — it's fetched once on app load and again whenever
  // the top-bar refresh button is tapped (same as every other cached page).
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);

  const refreshTicketUnreadCount = React.useCallback(() => {
    getStudentTicketUnreadCount()
      .then(res => setTicketUnreadCount(res.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshTicketUnreadCount();
  }, [refreshTicketUnreadCount, refreshToken]);

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
          setCertificateCount(Number(parsed?.certificateCount || 0));
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
  // The document/body no longer scrolls (see .dashboard-main), so this
  // reads scrollTop from whichever page's own scroll container is active.
  // All four swipe tabs are mounted at once now, so we keep one ref per
  // tab (indexed same as SWIPE_TABS) plus a separate one for the single
  // non-swipe (Outlet) route.
  const pageScrollRefs = useRef([]);
  const outletScrollRef = useRef(null);

  const setPageScrollRef = useCallback((idx) => (el) => {
    pageScrollRefs.current[idx] = el;
    if (idx === currentIndex) setScrolled(el ? el.scrollTop > 4 : false);
  }, [currentIndex]);
  const handlePageScroll = useCallback((idx) => (e) => {
    if (idx === currentIndex) setScrolled(e.currentTarget.scrollTop > 4);
  }, [currentIndex]);

  const setOutletScrollRef = useCallback((el) => {
    outletScrollRef.current = el;
    setScrolled(el ? el.scrollTop > 4 : false);
  }, []);
  const handleOutletScroll = useCallback((e) => {
    setScrolled(e.currentTarget.scrollTop > 4);
  }, []);

  const scrollToTop = useCallback(() => {
    const el = isSwipeTab ? pageScrollRefs.current[currentIndex] : outletScrollRef.current;
    el?.scrollTo({ top: 0, behavior: 'auto' });
  }, [isSwipeTab, currentIndex]);

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

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      // Clear the server-side FCM token and this browser's Firebase token
      // before removing the JWT, so this device receives no pushes after
      // logout. A later login registers a fresh token again.
      await unregisterPushNotifications('student');
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('userName');
      localStorage.removeItem('firstTimePasswordSet');
      clearAllOfflineCaches();
      navigate('/');
    }
  };

  const avatarInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const profileCompletion = (firstTimePasswordSet === true ? 50 : 25)
    + (profilePhoto ? 25 : 0)
    + (certificateCount > 0 ? 25 : 0);

  return (
    <div className="student-dashboard">
      {/* Fixed WhatsApp-style top bar: stays put while everything else scrolls */}
      <header className={`app-topbar ${scrolled ? 'scrolled' : ''}`}>
        <ProfileCompletionRing percent={profileCompletion} size={46} className="compact">
        <button
          className="app-topbar-avatar"
          onClick={() => setAvatarEnlarged(true)}
          aria-label="View profile photo"
          type="button"
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt={userName} className="no-img-callout" {...noImgCallout} />
          ) : (
            <span className="avatar-fallback">{avatarInitials}</span>
          )}
        </button>
        </ProfileCompletionRing>

        <span className="app-topbar-page-title">{pageTitle}</span>

        <button
          className={`app-topbar-refresh-btn${!isOnline ? ' offline' : ''}`}
          onClick={triggerRefresh}
          disabled={refreshing}
          aria-label={isOnline ? 'Refresh' : "You're offline"}
          title={isOnline ? undefined : "You're offline"}
          type="button"
        >
          <RefreshCw size={19} className={refreshing ? 'icon-spin' : ''} />
        </button>

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
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/student/tickets'); }}
                type="button"
              >
                <MessageSquare size={18} />
                <span>Help &amp; Support</span>
                {ticketUnreadCount > 0 && (
                  <span className="app-topbar-dropdown-badge" aria-label={`${ticketUnreadCount} resolved tickets`}>
                    {ticketUnreadCount > 99 ? '99+' : ticketUnreadCount}
                  </span>
                )}
              </button>
              <div className="app-topbar-dropdown-divider" role="separator" />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate('/student/appearance'); }}
                type="button"
              >
                <Palette size={18} />
                <span>Appearance</span>
              </button>
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

      {/* Nested student pages — a fixed pane between the top bar and bottom
          nav. The banners sit above the swipeable area (shown once, not
          per-tab), and the four swipe tabs live in a horizontal track that
          all four are mounted in simultaneously, so a partial drag reveals
          a sliver of the neighboring tab — like WhatsApp — rather than
          just animating whichever single route react-router has matched. */}
      <main
        className={`dashboard-main${isDragging ? ' dashboard-main-dragging' : ''}`}
        {...(isSwipeTab ? swipeHandlers : {})}
      >
        <div className="dashboard-main-banners">
          <OfflineBanner />
          <NotificationPermissionBanner role="student" />
          <InstallAppBanner />
        </div>

        <div className="dashboard-track-viewport" ref={trackViewportRef}>
          {isSwipeTab ? (
            <StudentTabProvider value={{ refreshTicketUnreadCount, scrollToTop, refreshToken }}>
              <div
                className="dashboard-track"
                style={{
                  width: paneWidth ? `${paneWidth * SWIPE_TABS.length}px` : '100%',
                  transform: `translateX(${-(currentIndex * paneWidth) + (isDragging ? dragX : 0)}px)`,
                  transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {SWIPE_TABS.map(({ path, Component }, idx) => (
                  <div
                    key={path}
                    className="dashboard-page-panel"
                    style={{ width: paneWidth ? `${paneWidth}px` : `${100 / SWIPE_TABS.length}%` }}
                    ref={setPageScrollRef(idx)}
                    onScroll={handlePageScroll(idx)}
                  >
                    <Component />
                  </div>
                ))}
              </div>
            </StudentTabProvider>
          ) : (
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={location.pathname}
                ref={setOutletScrollRef}
                onScroll={handleOutletScroll}
                className="dashboard-page-scroll"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={pageTransition}
              >
                <Outlet context={{ refreshTicketUnreadCount, scrollToTop, refreshToken }} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Bottom navigation */}
      <BottomNav progress={navIndicatorProgress} isDragging={isDragging} />

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
          <div
            className={`avatar-lightbox-content${profilePhoto ? ' avatar-lightbox-content-photo' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {profilePhoto ? (
              <img src={profilePhoto} alt={userName} className="no-img-callout" {...noImgCallout} />
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
