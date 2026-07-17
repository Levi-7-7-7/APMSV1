import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Mail,
  GitBranch,
  CalendarDays,
  Hash,
  Loader2,
} from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import '../css/Profile.css';

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tutor, setTutor] = useState(null);
  const [tutorLoading, setTutorLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Fetch student profile
  useEffect(() => {
    let cancelled = false;

    axiosInstance
      .get('/students/me')
      .then(res => {
        if (!cancelled) {
          setUser(res.data);
          localStorage.setItem('userData', JSON.stringify(res.data));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch assigned tutor
  useEffect(() => {
    let cancelled = false;

    axiosInstance
      .get('/students/my-tutor')
      .then(res => {
        if (!cancelled) setTutor(res.data.tutor ?? null);
      })
      .catch(() => {
        if (!cancelled) setTutor(null);
      })
      .finally(() => {
        if (!cancelled) setTutorLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePhotoClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await axiosInstance.patch('/students/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUser(prev => {
        const updated = { ...prev, profilePhoto: res.data.profilePhoto };
        localStorage.setItem('userData', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected later if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const userName = user?.name ?? 'Student';
  const registerNumber = user?.registerNumber ?? '—';
  const email = user?.email ?? '—';
  const batchName = user?.batch?.name ?? '—';
  const branchName = user?.branch?.name ?? '—';
  const entryType = user?.isLateralEntry ? 'Lateral Entry' : 'Regular';
  const initials = getInitials(userName);

  return (
    <div className="profile-page">
      {/* Hero */}
      <div className="profile-hero">
        <button className="profile-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="profile-hero-title">Profile</h1>

        <div className="profile-avatar-wrapper">
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt={userName} className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-fallback">
              <span>{initials || 'S'}</span>
            </div>
          )}

          <button
            className="profile-camera-badge"
            onClick={handlePhotoClick}
            disabled={uploading}
            aria-label="Change profile photo"
            type="button"
          >
            {uploading ? <Loader2 size={13} className="spin" /> : <Camera size={13} />}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChange}
          />
        </div>
      </div>

      {error && <div className="profile-error">{error}</div>}

      {/* Name block */}
      <div className="profile-name-block">
        {loading ? (
          <div className="skeleton skeleton-text" style={{ width: 140, height: 24 }} />
        ) : (
          <h2 className="profile-name">{userName}</h2>
        )}

        <div className="profile-reg-pill">
          <Hash size={13} />
          <span>{registerNumber}</span>
        </div>

        <div className={`profile-entry-badge ${user?.isLateralEntry ? 'warn' : 'success'}`}>
          {entryType}
        </div>
      </div>

      {/* Account info */}
      <p className="profile-section-label">ACCOUNT INFO</p>
      <div className="profile-card">
        <InfoRow icon={<Mail size={18} />} label="Email" value={email} />
        <div className="profile-divider" />
        <InfoRow icon={<GitBranch size={18} />} label="Branch" value={branchName} />
        <div className="profile-divider" />
        <InfoRow icon={<CalendarDays size={18} />} label="Batch" value={batchName} />
      </div>

      {/* Tutor */}
      <p className="profile-section-label">YOUR TUTOR</p>
      <div className="profile-card">
        {tutorLoading ? (
          <div className="profile-tutor-loading">
            <Loader2 size={18} className="spin" />
            <span>Finding your tutor…</span>
          </div>
        ) : tutor ? (
          <div className="profile-tutor-row">
            {tutor.profilePhoto ? (
              <img src={tutor.profilePhoto} alt={tutor.name} className="profile-tutor-avatar-img" />
            ) : (
              <div className="profile-tutor-avatar">
                <span>{getInitials(tutor.name)}</span>
              </div>
            )}

            <div className="profile-tutor-info">
              <span className="profile-tutor-name">{tutor.name}</span>
              <div className="profile-tutor-meta">
                {tutor.branch?.name && <span className="profile-meta-chip">{tutor.branch.name}</span>}
                {tutor.batch?.name && <span className="profile-meta-chip">{tutor.batch.name}</span>}
              </div>
              <span className="profile-tutor-email">{tutor.email}</span>
            </div>
          </div>
        ) : (
          <p className="profile-no-tutor">No tutor assigned yet.</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="profile-info-row">
      <div className="profile-icon-bubble">{icon}</div>
      <div className="profile-info-texts">
        <span className="profile-info-label">{label}</span>
        <span className="profile-info-value">{value}</span>
      </div>
    </div>
  );
}
