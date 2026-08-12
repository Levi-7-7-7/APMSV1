// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, GraduationCap, User, Lock, Loader2, Shield, Users, Award, BadgeCheck, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import adminAxios from '../api/adminAxios';
import tutorAxios from '../api/tutorAxios';
import BootLoader from '../components/BootLoader';
import { clearAllOfflineCaches } from '../utils/pageDataCache';
import InstallAppBanner from '../components/InstallAppBanner';
import mtiLogo from '../assets/mti-logo.png';
import '../css/Login.css';

const ROLE_META = {
  student: { label: 'Student', icon: GraduationCap },
  tutor:   { label: 'Tutor',   icon: Users },
  admin:   { label: 'Admin',   icon: Shield },
};

export default function Login() {
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [bootFadeOut, setBootFadeOut] = useState(false);

  const navigate = useNavigate();

  // On mount: if a valid session already exists, skip the login form
  // entirely. The backend runs on a free hosting tier that spins down
  // after inactivity, so this first request can take up to ~60s to wake
  // it back up — BootLoader keeps something on screen for that whole
  // wait, and we only navigate once we actually hear back.
  useEffect(() => {
    const restoreSession = async () => {
      const storedRole = localStorage.getItem('role');

      // Let the fade-out transition play for a moment before swapping the
      // route, so the loader doesn't just vanish mid-frame.
      const goTo = (path) => {
        setBootFadeOut(true);
        setTimeout(() => navigate(path, { replace: true }), 220);
      };

      if (storedRole === 'student' && localStorage.getItem('token')) {
        try {
          // Confirm the token actually still works before redirecting
          await axiosInstance.get('/students/me');
          goTo('/student');
          return;
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
        }
      } else if (storedRole === 'tutor' && localStorage.getItem('tutorToken')) {
        try {
          await tutorAxios.get('/tutors/me');
          goTo('/tutor/dashboard/students');
          return;
        } catch {
          localStorage.removeItem('tutorToken');
          localStorage.removeItem('role');
        }
      } else if (storedRole === 'admin' && localStorage.getItem('adminToken')) {
        try {
          await adminAxios.get('/admin/auth/me');
          goTo('/admin');
          return;
        } catch {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('role');
        }
      }
      setCheckingSession(false);
    };
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingSession) {
    return <BootLoader fadingOut={bootFadeOut} />;
  }

  // Reset fields when role changes
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setIdentifier('');
    setPassword('');
    setError('');
    setSuccess('');
  };

  // Login for student, tutor, or admin
  const handleLogin = async () => {
    setError('');
    setSuccess('');
    if (!identifier.trim() || !password) {
      setError(role === 'student' ? 'Register number and password are required' : 'Email and password are required');
      return;
    }
    setLoading(true);

    try {
      if (role === 'student') {
        const res = await axiosInstance.post('/auth/login', { registerNumber: identifier, password });
        if (!res?.data?.token) throw new Error('No token returned');
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', 'student');
        localStorage.setItem('userName', res.data.student?.name || 'Student');
        localStorage.setItem('firstTimePasswordSet', String(!!res.data.student?.firstTimePasswordSet));
        // A password reset/change happens outside the dashboard. Drop stale
        // cached dashboard data so the newly logged-in session always paints
        // the fresh firstTimePasswordSet/photo/certificate state.
        clearAllOfflineCaches();
        setSuccess(res.data.message || 'Login successful');
        navigate('/student');

      } else if (role === 'tutor') {
        const res = await axiosInstance.post('/tutors/login', { email: identifier, password });
        if (!res?.data?.token) throw new Error('No token returned');
        localStorage.setItem('tutorToken', res.data.token);
        localStorage.setItem('role', 'tutor');
        localStorage.setItem('tutorName', res.data.tutor?.name || 'Tutor');
        localStorage.setItem('tutorRole', res.data.tutor?.role || 'tutor');
        // Store assigned batch/branch so frontend can show it in header
        localStorage.setItem('tutorBatch',  JSON.stringify(res.data.tutor?.batch  || null));
        localStorage.setItem('tutorBranch', JSON.stringify(res.data.tutor?.branch || null));
        localStorage.setItem('tutorFirstTimePasswordSet', String(!!res.data.tutor?.firstTimePasswordSet));
        setSuccess(res.data.message || 'Login successful');
        navigate('/tutor/dashboard/students');

      } else if (role === 'admin') {
        const res = await adminAxios.post('/admin/auth/login', { email: identifier, password });
        if (!res?.data?.token) throw new Error('No token returned');
        localStorage.setItem('adminToken', res.data.token);
        localStorage.setItem('role', 'admin');
        setSuccess('Admin login successful');
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = role === 'admin';
  const RoleIcon = ROLE_META[role].icon;

  return (
    <div className="auth-shell">
      {/* Brand panel — full split rail on desktop, short "app hero" strip
          on mobile that the card overlaps like a bottom sheet. */}
      <div className={`auth-brand auth-brand-${role}`}>
        <div className="auth-brand-shield" aria-hidden="true" />
        <div className="auth-brand-content">
          <img src={mtiLogo} alt="" className="auth-brand-crest" draggable={false} />
          <p className="auth-brand-eyebrow">MTI &middot; Activity Points</p>
          <h1 className="auth-brand-title">Track what you build,<br />earn what you learn.</h1>
          <p className="auth-brand-tagline">
            One home for every certificate, activity and point earned across your time here.
          </p>

          <div className="auth-badges" aria-hidden="true">
            <div className="auth-badge auth-badge-1">
              <Award size={16} /> <span>+15 Activity Points</span>
            </div>
            <div className="auth-badge auth-badge-2">
              <BadgeCheck size={16} /> <span>Certificate verified</span>
            </div>
            <div className="auth-badge auth-badge-3">
              <TrendingUp size={16} /> <span>Level: Achiever</span>
            </div>
          </div>

          <p className="auth-brand-motto">स्वावलंबी धनी है &nbsp;&middot;&nbsp; Self-reliance is wealth</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <span className={`auth-card-icon auth-card-icon-${role}`}>
              <RoleIcon size={22} />
            </span>
            <div>
              <h2 className="auth-card-title">Welcome back</h2>
              <p className="auth-card-subtitle">
                {isAdmin ? 'Sign in to the admin portal' : `Sign in to your ${role} account`}
              </p>
            </div>
          </div>

          <InstallAppBanner />

          {/* Role Selector */}
          <div className="role-tabs">
            {['student', 'tutor', 'admin'].map((r) => {
              const TabIcon = ROLE_META[r].icon;
              return (
                <button
                  key={r}
                  className={`role-tab role-tab-${r} ${role === r ? 'active' : ''}`}
                  onClick={() => handleRoleChange(r)}
                  disabled={loading}
                >
                  <TabIcon size={15} />
                  {ROLE_META[r].label}
                </button>
              );
            })}
          </div>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          <div className="form-group">
            <label className="form-label">
              <User size={16} /> {role === 'student' ? 'Register Number' : 'Email'}
            </label>
            <input
              type={role === 'student' ? 'text' : 'email'}
              placeholder={role === 'student' ? 'Enter your register number' : 'Enter your email'}
              className="form-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group password-wrapper">
            <label className="form-label">
              <Lock size={16} /> Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={role === 'student' ? 'Enter the password from your welcome email' : 'Enter your password'}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button type="button" className="show-password-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="form-footer">
            <button
              type="button"
              className="forgot-password"
              onClick={() => navigate(
                role === 'tutor' ? '/tutor/forgot-password'
                  : role === 'admin' ? '/admin/forgot-password'
                  : '/forgot-password'
              )}
              disabled={loading}
            >
              Reset / Forgot Password?
            </button>
          </div>

          <button
            className={`btn-primary auth-submit auth-submit-${role}`}
            onClick={handleLogin}
            disabled={!identifier || !password || loading}
          >
            {loading ? (
              <>
                <span className="login-btn-spinner-wrap">
                  <Loader2 size={20} className="login-btn-spinner-icon" />
                </span>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <RoleIcon size={18} />
                {isAdmin ? 'Sign In as Admin' : 'Sign In'}
              </>
            )}
          </button>

          <div className="footer-text">Need help? Contact your institution's IT support</div>
        </div>
      </div>
    </div>
  );
}
