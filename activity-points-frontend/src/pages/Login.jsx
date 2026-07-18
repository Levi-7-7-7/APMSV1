// src/pages/Login.jsx
import React, { useState } from 'react';
import { Eye, EyeOff, GraduationCap, User, Lock, Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import adminAxios from '../api/adminAxios';
import '../css/Login.css';

export default function Login() {
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          {isAdmin
            ? <Shield size={48} color="#7c3aed" />
            : <GraduationCap size={48} color="#1e3a8a" />
          }
          <h1>Activity Points</h1>
          <p>{isAdmin ? 'Admin Portal' : 'Management System'}</p>
        </div>

        {/* Role Selector */}
        <div className="role-tabs">
          {['student', 'tutor', 'admin'].map((r) => (
            <button
              key={r}
              className={`role-tab ${role === r ? 'active' : ''} ${r === 'admin' ? 'admin-tab' : ''}`}
              onClick={() => handleRoleChange(r)}
              disabled={loading}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
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
            placeholder={role === 'student' ? 'Default: firstname + 12345 (e.g. arjun12345)' : 'Enter your password'}
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

        {role !== 'admin' && (
          <div className="form-footer">
            <button
              type="button"
              className="forgot-password"
              onClick={() => navigate(role === 'tutor' ? '/tutor/forgot-password' : '/forgot-password')}
              disabled={loading}
            >
              Reset / Forgot Password?
            </button>
          </div>
        )}

        <button
          className={`btn-primary ${isAdmin ? 'btn-admin' : ''}`}
          onClick={handleLogin}
          disabled={!identifier || !password || loading}
          style={{ marginTop: '1rem' }}
        >
          {loading ? (
            <><Loader2 size={20} className="spinner" /> Signing In...</>
          ) : (
            isAdmin ? '🛡️ Sign In as Admin' : 'Sign In'
          )}
        </button>
      </div>

      <div className="footer-text">Need help? Contact your institution's IT support</div>
    </div>
  );
}
