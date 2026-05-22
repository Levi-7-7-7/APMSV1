import React, { useState } from 'react';
import tutorAxios from '../api/tutorAxios';
import { useNavigate } from 'react-router-dom';

export default function TutorForgotPassword() {
  const navigate = useNavigate();

  // Step 1: enter email
  // Step 2: enter OTP + new password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch    = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Step 1 — send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/forgot-password', { email: email.trim().toLowerCase() });
      setMaskedEmail(res.data.maskedEmail || '');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + reset password
  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || !newPassword || !confirmPassword) { setError('All fields are required'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Check your OTP and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setOtp('');
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/forgot-password', { email: email.trim().toLowerCase() });
      setMaskedEmail(res.data.maskedEmail || maskedEmail);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>{step === 1 ? 'Forgot Password' : 'Reset Password'}</h1>
          <p>
            {step === 1
              ? 'Enter your registered email address to receive an OTP'
              : <>OTP sent to <strong>{maskedEmail}</strong></>}
          </p>
        </div>

        {/* ── STEP 1: Email ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={email}
                required
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. tutor@college.edu"
                className="form-input"
                disabled={loading}
                autoCapitalize="none"
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim()}
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <button
              type="button"
              className="forgot-password"
              onClick={() => navigate('/')}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              ← Back to Login
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP + new password ── */}
        {step === 2 && (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label className="form-label">OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                required
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="form-input"
                disabled={loading}
                autoComplete="one-time-code"
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  required
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="form-input"
                  disabled={loading}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '18px' }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  required
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="form-input"
                  disabled={loading}
                  style={{
                    paddingRight: '2.5rem',
                    borderColor: passwordsMatch ? '#16a34a' : passwordsMismatch ? '#dc2626' : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '18px' }}
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {passwordsMismatch && <p className="error-message" style={{ marginTop: '4px' }}>Passwords do not match</p>}
              {passwordsMatch    && <p style={{ color: '#16a34a', fontSize: '13px', marginTop: '4px' }}>✓ Passwords match</p>}
            </div>

            {error   && <p className="error-message">{error}</p>}
            {success && <p className="success-message">✅ {success} Redirecting to login...</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || passwordsMismatch || !otp || !newPassword}
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button type="button" className="forgot-password" onClick={() => { setStep(1); setError(''); setOtp(''); }}>
                ← Change Email
              </button>
              <button type="button" className="forgot-password" onClick={handleResend} disabled={loading}>
                Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
