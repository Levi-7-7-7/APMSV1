import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
import PhotoCropModal from '../components/PhotoCropModal';
import { getCached, setCached, isSessionCached } from '../utils/pageDataCache';
import { noImgCallout } from '../utils/noImgCallout';
import '../css/Profile.css';

const CACHE_KEY = 'profile';

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
  const { refreshToken } = useOutletContext() || {};
  const lastRefreshToken = useRef(refreshToken);

  const cached = getCached(CACHE_KEY);
  const [user, setUser] = useState(cached?.user ?? null);
  const [loading, setLoading] = useState(!cached);

  const [tutor, setTutor] = useState(cached?.tutor ?? null);
  const [tutorLoading, setTutorLoading] = useState(!cached);

  const [hod, setHod] = useState(cached?.hod ?? null);
  const [principal, setPrincipal] = useState(cached?.principal ?? null);
  const [staffLoading, setStaffLoading] = useState(!cached);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Full-screen tap-to-enlarge viewer (matches native app's photo viewer)
  const [viewerImage, setViewerImage] = useState(null);

  // Fetch student profile, assigned tutor, and HOD/Principal together.
  // Reuses cached data on a plain remount (e.g. swiping/navigating back to
  // this tab); only hits the network on first-ever load or when the global
  // refresh button bumps refreshToken.
  useEffect(() => {
    const isRefresh = refreshToken !== undefined && refreshToken !== lastRefreshToken.current;
    lastRefreshToken.current = refreshToken;
    // False on a cold start even though this component's top-level
    // getCached(CACHE_KEY) call (for instant paint) has already run —
    // that's just a passive read, not a real fetch, so it doesn't mark
    // the key session-fetched. See pageDataCache.js for why.
    const alreadySessionCached = isSessionCached(CACHE_KEY);
    const existing = getCached(CACHE_KEY);
    if (existing && !isRefresh && alreadySessionCached) {
      setUser(existing.user);
      setTutor(existing.tutor);
      setHod(existing.hod);
      setPrincipal(existing.principal);
      setLoading(false);
      setTutorLoading(false);
      setStaffLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTutorLoading(true);
    setStaffLoading(true);

    const nextData = { user: null, tutor: null, hod: null, principal: null };

    axiosInstance
      .get('/students/me')
      .then(res => {
        if (cancelled) return;
        nextData.user = res.data;
        setUser(res.data);
        localStorage.setItem('userData', JSON.stringify(res.data));
        setCached(CACHE_KEY, { ...getCached(CACHE_KEY), ...nextData });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    axiosInstance
      .get('/students/my-tutor')
      .then(res => {
        if (cancelled) return;
        nextData.tutor = res.data.tutor ?? null;
        setTutor(nextData.tutor);
        setCached(CACHE_KEY, { ...getCached(CACHE_KEY), ...nextData });
      })
      .catch(() => {
        if (!cancelled) setTutor(null);
      })
      .finally(() => {
        if (!cancelled) setTutorLoading(false);
      });

    axiosInstance
      .get('/students/my-staff')
      .then(res => {
        if (cancelled) return;
        nextData.hod = res.data.hod ?? null;
        nextData.principal = res.data.principal ?? null;
        setHod(nextData.hod);
        setPrincipal(nextData.principal);
        setCached(CACHE_KEY, { ...getCached(CACHE_KEY), ...nextData });
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
  }, [refreshToken]);

  const handlePhotoClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  // Selecting a file no longer uploads immediately — it opens an
  // interactive crop tool (drag to reposition, slider to zoom) so the
  // user can pick exactly how their photo appears in the circular
  // avatar before confirming.
  const [pendingFile, setPendingFile] = useState(null);

  const handleFileChange = useCallback(e => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setError('');
    setPendingFile(file);
  }, []);

  const closeCropModal = useCallback(() => {
    setPendingFile(null);
  }, []);

  const confirmUpload = useCallback(async croppedFile => {
    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', croppedFile);

      const res = await axiosInstance.patch('/students/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUser(prev => {
        const updated = { ...prev, profilePhoto: res.data.profilePhoto };
        localStorage.setItem('userData', JSON.stringify(updated));
        setCached(CACHE_KEY, { ...getCached(CACHE_KEY), user: updated });
        return updated;
      });
      setPendingFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
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
              className="profile-avatar-img profile-avatar-clickable no-img-callout"
              onClick={() => setViewerImage(user.profilePhoto)}
              {...noImgCallout}
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
            {uploading ? <Loader2 size={13} className="icon-spin" /> : <Camera size={13} />}
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
            <Loader2 size={18} className="icon-spin" />
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
            <Loader2 size={18} className="icon-spin" />
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
            <Loader2 size={18} className="icon-spin" />
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

      {/* Tap-to-enlarge photo viewer — full frame, WhatsApp-style, rather
          than cropped into the small circular badge used elsewhere.
          Portaled to document.body: this page renders inside StudentLayout's
          animated <motion.div> route transition, and framer-motion's x
          animation applies a CSS transform to that wrapper — which breaks
          position:fixed the same way the swipe track's transform did. */}
      {viewerImage && createPortal(
        <div className="profile-viewer-backdrop" onClick={() => setViewerImage(null)}>
          <button
            className="profile-viewer-close"
            onClick={() => setViewerImage(null)}
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>
          <div className="profile-viewer-photo" onClick={e => e.stopPropagation()}>
            <img src={viewerImage} alt="Enlarged profile" className="profile-viewer-img no-img-callout" {...noImgCallout} />
          </div>
        </div>,
        document.body
      )}

      {/* Interactive crop tool shown before confirming a new photo upload */}
      <PhotoCropModal
        file={pendingFile}
        uploading={uploading}
        error={error}
        onCancel={closeCropModal}
        onConfirm={confirmUpload}
      />
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
          className="profile-tutor-avatar-img profile-avatar-clickable no-img-callout"
          onClick={() => onEnlarge(person.profilePhoto)}
          {...noImgCallout}
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