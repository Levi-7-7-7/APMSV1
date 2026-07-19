import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Mail,
  GitBranch,
  CalendarDays,
  Users,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import tutorAxios from '../api/tutorAxios';
import PhotoCropModal from '../components/PhotoCropModal';
import '../css/TutorProfile.css';

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_BADGE_LABELS = { tutor: 'Tutor', hod: 'HOD', principal: 'Principal' };
const ROLE_TITLES       = { tutor: 'Class Tutor', hod: 'Head of Department', principal: 'Principal' };
const ROLE_ACCESS       = {
  tutor:     'Certificate Review · Student Management (own batch & branch)',
  hod:       'Certificate Review · Student Management (entire department)',
  principal: 'Certificate Review · Student Management (all batches & branches)',
};

export default function TutorProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [studentCount, setStudentCount] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Optimistic photo state (updates instantly after upload)
  const [localPhoto, setLocalPhoto] = useState(null);

  // Tap-to-enlarge photo viewer
  const [viewerImage, setViewerImage] = useState(null);

  // Fetch tutor profile + student count (mirrors TutorProfileScreen.tsx)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setProfileLoading(true);
      try {
        const [meRes, studentsRes] = await Promise.all([
          tutorAxios.get('/tutors/me'),
          tutorAxios.get('/tutors/students'),
        ]);

        if (!cancelled) {
          setProfile(meRes.data);
          setLocalPhoto(meRes.data.profilePhoto ?? null);

          const students = Array.isArray(studentsRes.data)
            ? studentsRes.data
            : studentsRes.data?.students ?? [];
          setStudentCount(students.length);

          // Keep the header's cached name in sync
          if (meRes.data.name) {
            localStorage.setItem('tutorName', meRes.data.name);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Could not load profile.');
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePhotoClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  // Selecting a file no longer uploads immediately — it opens an
  // interactive crop tool (drag to reposition, slider to zoom) so the
  // tutor can pick exactly how their photo appears in the circular
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

      const res = await tutorAxios.patch('/tutors/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLocalPhoto(res.data.profilePhoto);
      setProfile(prev => (prev ? { ...prev, profilePhoto: res.data.profilePhoto } : prev));
      setPendingFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const tutorName = profile?.name || localStorage.getItem('tutorName') || 'Tutor';
  const tutorEmail = profile?.email ?? '—';
  const tutorRole = profile?.role || localStorage.getItem('tutorRole') || 'tutor';
  const batchName = profile?.batch?.name ?? (tutorRole === 'tutor' ? '—' : 'All Batches');
  const branchName = profile?.branch?.name ?? (tutorRole === 'principal' ? 'All Branches' : '—');
  const initials = getInitials(tutorName);
  const hasPhoto = Boolean(localPhoto);

  return (
    <div className="tprofile-page">
      {/* Hero */}
      <div className="tprofile-hero">
        <button className="tprofile-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>

        <h1 className="tprofile-hero-title">Profile</h1>

        <div className="tprofile-role-badge">
          <ShieldCheck size={13} />
          <span>{ROLE_BADGE_LABELS[tutorRole] || 'Tutor'}</span>
        </div>

        <div className="tprofile-avatar-wrapper">
          {hasPhoto ? (
            <img
              src={localPhoto}
              alt={tutorName}
              className="tprofile-avatar-img tprofile-avatar-clickable"
              onClick={() => setViewerImage(localPhoto)}
            />
          ) : (
            <div
              className="tprofile-avatar-fallback tprofile-avatar-clickable"
              onClick={handlePhotoClick}
            >
              <span>{initials || 'T'}</span>
            </div>
          )}

          <button
            className="tprofile-camera-badge"
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

      {error && <div className="tprofile-error">{error}</div>}

      {/* Name block */}
      <div className="tprofile-name-block">
        {profileLoading ? (
          <div className="skeleton skeleton-text" style={{ width: 140, height: 24 }} />
        ) : (
          <h2 className="tprofile-name">{tutorName}</h2>
        )}

        <div className="tprofile-email-pill">
          <Mail size={13} />
          <span>{tutorEmail}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="tprofile-stats-row">
        <StatCard
          icon={<Users size={20} />}
          value={studentCount !== null ? String(studentCount) : '—'}
          label="Students"
        />
        <StatCard icon={<CalendarDays size={20} />} value={batchName} label="Batch" />
        <StatCard icon={<GitBranch size={20} />} value={branchName} label="Branch" />
      </div>

      {/* Account info */}
      <p className="tprofile-section-label">ACCOUNT INFO</p>
      <div className="tprofile-card">
        <InfoRow icon={<Mail size={18} />} label="Email" value={tutorEmail} />
        <div className="tprofile-divider" />
        <InfoRow icon={<GitBranch size={18} />} label="Branch" value={branchName} />
        <div className="tprofile-divider" />
        <InfoRow icon={<CalendarDays size={18} />} label="Batch" value={batchName} />
      </div>

      {/* Role info */}
      <p className="tprofile-section-label">ROLE</p>
      <div className="tprofile-card">
        <InfoRow icon={<ShieldCheck size={18} />} label="Role" value={ROLE_TITLES[tutorRole] || 'Class Tutor'} />
        <div className="tprofile-divider" />
        <InfoRow
          icon={<CheckCircle2 size={18} />}
          label="Access"
          value={ROLE_ACCESS[tutorRole] || ROLE_ACCESS.tutor}
        />
      </div>

      {/* Tap-to-enlarge photo viewer, shown as a circle to match how the
          photo appears everywhere else in the app */}
      {viewerImage && (
        <div className="tprofile-viewer-backdrop" onClick={() => setViewerImage(null)}>
          <button
            className="tprofile-viewer-close"
            onClick={() => setViewerImage(null)}
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>
          <div className="tprofile-viewer-circle" onClick={e => e.stopPropagation()}>
            <img src={viewerImage} alt="Enlarged profile" className="tprofile-viewer-img" />
          </div>
        </div>
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

function StatCard({ icon, value, label }) {
  return (
    <div className="tprofile-stat-card">
      <div className="tprofile-stat-icon-bg">{icon}</div>
      <span className="tprofile-stat-value" title={value}>
        {value}
      </span>
      <span className="tprofile-stat-label">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="tprofile-info-row">
      <div className="tprofile-icon-bubble">{icon}</div>
      <div className="tprofile-info-texts">
        <span className="tprofile-info-label">{label}</span>
        <span className="tprofile-info-value">{value}</span>
      </div>
    </div>
  );
}