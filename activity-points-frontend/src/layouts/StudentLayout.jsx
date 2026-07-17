import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import '../css/StudentDashboard.css';

const StudentLayout = () => {
  const navigate = useNavigate();

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
        } catch (_) {}
      }
    };
    window.addEventListener('storage', sync);
    // Also poll once shortly after mount in case Dashboard sets it in the same tab
    const timer = setTimeout(sync, 800);
    return () => { window.removeEventListener('storage', sync); clearTimeout(timer); };
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('userName');
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
      {/* Header */}
      <header className="dashboard-header">
                    <div className="header-top">
                    <div className="avatar-group">
                        <button
                          className="avatar avatar-btn"
                          onClick={() => navigate('/student/profile')}
                          aria-label="View profile"
                          type="button"
                        >
                        {profilePhoto ? (
                          <img src={profilePhoto} alt={userName} />
                        ) : (
                          <span className="avatar-fallback">{avatarInitials}</span>
                        )}
                        </button>
                        <div className="greeting">
                        <h1>Hello, {userName}</h1>
                        <p>Welcome back!</p>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button
                        onClick={handleLogout}
                        className="logout-btn-header"
                        >
                        Logout
                        </button>
                    </div>
                    </div>

      </header>

      {/* Nested student pages */}
      <main className="dashboard-main">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
};

export default StudentLayout;
