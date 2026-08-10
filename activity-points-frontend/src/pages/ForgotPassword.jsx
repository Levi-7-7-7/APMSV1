import React, { useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('current'); // current | forgot
  const [step, setStep] = useState('form'); // form | otp
  const [registerNumber, setRegisterNumber] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const eyeBtnStyle = {
    position: 'absolute',
    right: '2px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--slate-500, #64748b)',
    padding: 0,
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setStep('form');
    setOldPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setMaskedEmail('');
    resetMessages();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!registerNumber.trim() || !oldPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/change-password', {
        registerNumber: registerNumber.trim(),
        oldPassword,
        newPassword,
        confirmPassword,
      });
      setSuccess(res.data.message || 'Password changed successfully.');
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!registerNumber.trim()) {
      setError('Please enter your register number');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/forgot-password', {
        registerNumber: registerNumber.trim(),
      });
      setMaskedEmail(res.data.maskedEmail || '');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpReset = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!otp || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/reset-password', {
        registerNumber: registerNumber.trim(),
        otp,
        newPassword,
      });
      setSuccess(res.data.message || 'Password reset successfully.');
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Check your OTP and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    resetMessages();
    setOtp('');
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/forgot-password', {
        registerNumber: registerNumber.trim(),
      });
      setMaskedEmail(res.data.maskedEmail || maskedEmail);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordField = (label, value, setter, visible, setVisible, placeholder) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          required
          onChange={e => setter(e.target.value)}
          placeholder={placeholder}
          className="form-input"
          disabled={loading}
          style={{ paddingRight: '2.5rem' }}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={eyeBtnStyle}
        >
          {visible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>{mode === 'current' ? 'Reset Password' : step === 'otp' ? 'Enter OTP' : 'Forgot Password'}</h1>
          <p>
            {mode === 'current'
              ? 'Change your password using your current password'
              : step === 'otp'
                ? <>OTP sent to <strong>{maskedEmail}</strong></>
                : 'We will send a one-time password to your registered email'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`mode-btn ${mode === 'current' ? 'active' : ''}`}
            onClick={() => switchMode('current')}
            disabled={loading}
            style={{ flex: 1 }}
          >
            I know my password
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'forgot' ? 'active' : ''}`}
            onClick={() => switchMode('forgot')}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Forgot password
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}
        {success && (
          <p className="success-message" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircleRoundedIcon fontSize="small" /> {success} Redirecting to login...
          </p>
        )}

        {mode === 'current' && (
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Register Number</label>
              <input
                type="text"
                value={registerNumber}
                required
                onChange={e => setRegisterNumber(e.target.value)}
                placeholder="Enter your register number"
                className="form-input"
                disabled={loading}
              />
            </div>

            {renderPasswordField('Current Password', oldPassword, setOldPassword, showOld, setShowOld, 'Enter your current password')}
            {renderPasswordField('New Password', newPassword, setNewPassword, showNew, setShowNew, 'At least 8 characters')}
            {renderPasswordField('Confirm New Password', confirmPassword, setConfirmPassword, showConfirm, setShowConfirm, 'Re-enter your new password')}

            {passwordsMismatch && <p className="error-message" style={{ marginTop: '-4px' }}>Passwords do not match</p>}
            {passwordsMatch && <p style={{ color: '#16a34a', fontSize: '13px', marginTop: '-4px' }}>✓ Passwords match</p>}

            <button type="submit" className="btn-primary" disabled={loading || passwordsMismatch || !registerNumber.trim() || !oldPassword || !newPassword || !confirmPassword} style={{ marginTop: '1rem' }}>
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        )}

        {mode === 'forgot' && step === 'form' && (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Register Number</label>
              <input
                type="text"
                value={registerNumber}
                required
                onChange={e => setRegisterNumber(e.target.value)}
                placeholder="Enter your register number"
                className="form-input"
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !registerNumber.trim()} style={{ marginTop: '1rem' }}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {mode === 'forgot' && step === 'otp' && (
          <form onSubmit={handleOtpReset}>
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

            {renderPasswordField('New Password', newPassword, setNewPassword, showNew, setShowNew, 'At least 8 characters')}
            {renderPasswordField('Confirm New Password', confirmPassword, setConfirmPassword, showConfirm, setShowConfirm, 'Re-enter your new password')}

            {passwordsMismatch && <p className="error-message" style={{ marginTop: '-4px' }}>Passwords do not match</p>}
            {passwordsMatch && <p style={{ color: '#16a34a', fontSize: '13px', marginTop: '-4px' }}>✓ Passwords match</p>}

            <button type="submit" className="btn-primary" disabled={loading || passwordsMismatch || !otp || !newPassword || !confirmPassword} style={{ marginTop: '1rem' }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button type="button" className="forgot-password" onClick={() => { setStep('form'); resetMessages(); setOtp(''); }}>
                ← Change Register No.
              </button>
              <button type="button" className="forgot-password" onClick={handleResend} disabled={loading}>
                Resend OTP
              </button>
            </div>
          </form>
        )}

        <button type="button" className="forgot-password" onClick={() => navigate('/')} style={{ marginTop: '1rem', width: '100%' }}>
          ← Back to Login
        </button>
      </div>
    </div>
  );
}
