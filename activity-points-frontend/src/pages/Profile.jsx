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
  X,
  HelpCircle,
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

// Resize/compress an image client-side before upload (matches native app:
// 600x600 JPEG @ 80% quality) so behavior is consistent across platforms.
function resizeImage(file, maxSize = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Could not process image.'));
              return;
            }
            resolve(new File([blob], file.name || 'profile.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tutor, setTutor] = useState(null);
  const [tutorLoading, setTutorLoading] = useState(true);

  const [hod, setHod] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Full-screen tap-to-enlarge viewer (matches native app's photo viewer)
  const [viewerImage, setViewerImage] = useState(null);

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

  // Fetch HOD (branch-scoped) and Principal (global)
  useEffect(() => {
    let cancelled = false;

    axiosInstance
      .get('/students/my-staff')
      .then(res => {
        if (!cancelled) {
          setHod(res.data.hod ?? null);
          setPrincipal(res.data.principal ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHod(null);
          setPrincipal(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false);
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
      const resized = await resizeImage(file);

      const formData = new FormData();
      formData.append('photo', resized);

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
            <img
              src={user.profilePhoto}
              alt={userName}
              className="profile-avatar-img profile-avatar-clickable"
              onClick={() => setViewerImage(user.profilePhoto)}
            />
          ) : (
            <div
              className="profile-avatar-fallback profile-avatar-clickable"
              onClick={handlePhotoClick}
            >
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
          <StaffRow person={tutor} onEnlarge={setViewerImage} showBatch />
        ) : (
          <div className="profile-tutor-loading">
            <HelpCircle size={22} />
            <span>No tutor assigned to your batch yet</span>
          </div>
        )}
      </div>

      {/* HOD */}
      <p className="profile-section-label">YOUR HOD</p>
      <div className="profile-card">
        {staffLoading ? (
          <div className="profile-tutor-loading">
            <Loader2 size={18} className="spin" />
            <span>Finding your HOD…</span>
          </div>
        ) : hod ? (
          <StaffRow person={hod} onEnlarge={setViewerImage} />
        ) : (
          <div className="profile-tutor-loading">
            <HelpCircle size={22} />
            <span>No HOD assigned to your branch yet</span>
          </div>
        )}
      </div>

      {/* Principal */}
      <p className="profile-section-label">PRINCIPAL</p>
      <div className="profile-card">
        {staffLoading ? (
          <div className="profile-tutor-loading">
            <Loader2 size={18} className="spin" />
            <span>Finding the principal…</span>
          </div>
        ) : principal ? (
          <StaffRow person={principal} onEnlarge={setViewerImage} />
        ) : (
          <div className="profile-tutor-loading">
            <HelpCircle size={22} />
            <span>No principal added yet</span>
          </div>
        )}
      </div>

      {/* Tap-to-enlarge photo viewer */}
      {viewerImage && (
        <div className="profile-viewer-backdrop" onClick={() => setViewerImage(null)}>
          <button
            className="profile-viewer-close"
            onClick={() => setViewerImage(null)}
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>
          <img
            src={viewerImage}
            alt="Enlarged profile"
            className="profile-viewer-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
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

function StaffRow({ person, onEnlarge, showBatch = false }) {
  return (
    <div className="profile-tutor-row">
      {person.profilePhoto ? (
        <img
          src={person.profilePhoto}
          alt={person.name}
          className="profile-tutor-avatar-img profile-avatar-clickable"
          onClick={() => onEnlarge(person.profilePhoto)}
        />
      ) : (
        <div className="profile-tutor-avatar">
          <span>{getInitials(person.name)}</span>
        </div>
      )}

      <div className="profile-tutor-info">
        <span className="profile-tutor-name">{person.name}</span>
        <div className="profile-tutor-meta">
          {person.branch?.name && <span className="profile-meta-chip">{person.branch.name}</span>}
          {showBatch && person.batch?.name && <span className="profile-meta-chip">{person.batch.name}</span>}
        </div>
        <span className="profile-tutor-email">{person.email}</span>
      </div>
    </div>
  );
}
