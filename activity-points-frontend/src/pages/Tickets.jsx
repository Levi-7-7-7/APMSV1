import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { Plus, Image as ImageIcon, X, Clock, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { createStudentTicket, getMyTickets, markStudentTicketSeen } from '../utils/ticketApi';
import { getCached, setCached, isSessionCached } from '../utils/pageDataCache';
import '../css/Tickets.css';

const CACHE_KEY = 'tickets';

function StatusBadge({ status }) {
  return status === 'resolved' ? (
    <span className="ticket-badge resolved"><CheckCircle2 size={13} /> Resolved</span>
  ) : (
    <span className="ticket-badge open"><Clock size={13} /> Open</span>
  );
}

export default function Tickets() {
  const { refreshTicketUnreadCount, refreshToken } = useOutletContext() || {};
  const isOnline = useOnlineStatus();
  const lastRefreshToken = useRef(refreshToken);
  const cached = getCached(CACHE_KEY);
  const [tickets, setTickets] = useState(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyTickets();
      const next = res.data || [];
      setTickets(next);
      setCached(CACHE_KEY, next);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reuse cached data on a plain remount (e.g. swiping back to this tab);
    // only hit the network on first-ever load or when the global refresh
    // button bumps refreshToken.
    const isRefresh = refreshToken !== undefined && refreshToken !== lastRefreshToken.current;
    lastRefreshToken.current = refreshToken;
    // False on a cold start even though this component's top-level
    // getCached(CACHE_KEY) call (for instant paint) has already run —
    // that's just a passive read, not a real fetch, so it doesn't mark
    // the key session-fetched. See pageDataCache.js for why.
    const alreadySessionCached = isSessionCached(CACHE_KEY);
    const existing = getCached(CACHE_KEY);
    if (existing && !isRefresh && alreadySessionCached) {
      setTickets(existing);
      setLoading(false);
      return;
    }
    load();
  }, [refreshToken]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setSubject('');
    setDescription('');
    clearImage();
    setFormError('');
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setFormError('Please fill in both subject and description.');
      return;
    }
    if (!isOnline) {
      setFormError("You're offline. Connect to the internet to raise a request.");
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      if (imageFile) formData.append('image', imageFile);

      const res = await createStudentTicket(formData);
      setTickets((prev) => {
        const next = [res.data, ...prev];
        setCached(CACHE_KEY, next);
        return next;
      });
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to raise request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = async (ticket) => {
    const opening = expandedId !== ticket._id;
    setExpandedId(opening ? ticket._id : null);

    // Mark as read the moment they open a resolved ticket they haven't seen yet.
    if (opening && ticket.status === 'resolved' && ticket.raiserSeen === false) {
      try {
        await markStudentTicketSeen(ticket._id);
        setTickets((prev) => {
          const next = prev.map((t) => (t._id === ticket._id ? { ...t, raiserSeen: true } : t));
          setCached(CACHE_KEY, next);
          return next;
        });
        refreshTicketUnreadCount?.();
      } catch (_) {}
    }
  };

  return (
    <div className="tickets-page">
      <div className="tickets-page-header">
        <p className="tickets-page-subtitle">
          Raise a request and your tutor will take a look — they'll either resolve it or pass it on to admin.
        </p>
        <button type="button" className="tickets-new-btn" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> {showForm ? 'Cancel' : 'Raise a Request'}
        </button>
      </div>

      {showForm && (
        <form className="ticket-form" onSubmit={handleSubmit}>
          <label className="ticket-form-label">
            Subject
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary, e.g. 'Certificate points not updated'"
              maxLength={150}
            />
          </label>

          <label className="ticket-form-label">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={4}
              maxLength={2000}
            />
          </label>

          <div className="ticket-form-image">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
            {imagePreview ? (
              <div className="ticket-image-preview">
                <img src={imagePreview} alt="Attachment preview" />
                <button type="button" className="ticket-image-remove" onClick={clearImage} aria-label="Remove image">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="ticket-image-add" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon size={16} /> Attach a photo (optional)
              </button>
            )}
          </div>

          {formError && <div className="ticket-form-error">{formError}</div>}

          <button type="submit" className="ticket-form-submit" disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="icon-spin" /> Submitting…</> : 'Submit Request'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="tickets-empty">Loading your requests…</div>
      ) : error ? (
        <div className="tickets-empty error">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="tickets-empty">You haven't raised any requests yet.</div>
      ) : (
        <div className="tickets-list">
          {tickets.map((t) => (
            <div key={t._id} className={`ticket-card ${t.status === 'resolved' && !t.raiserSeen ? 'unseen' : ''}`}>
              <button type="button" className="ticket-card-head" onClick={() => toggleExpand(t)}>
                <div className="ticket-card-head-text">
                  <span className="ticket-subject">{t.subject}</span>
                  <span className="ticket-date">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <StatusBadge status={t.status} />
                <ChevronDown size={16} className={`ticket-chevron ${expandedId === t._id ? 'open' : ''}`} />
              </button>

              {expandedId === t._id && (
                <div className="ticket-card-body">
                  <p className="ticket-description">{t.description}</p>
                  {t.imageUrl && (
                    <a href={t.imageUrl} target="_blank" rel="noreferrer" className="ticket-attachment-link">
                      <img src={t.imageUrl} alt="Attachment" className="ticket-attachment-img" />
                    </a>
                  )}
                  {t.forwardedToAdmin && (
                    <div className="ticket-note">Forwarded to admin{t.forwardedBy?.name ? ` by ${t.forwardedBy.name}` : ''}.</div>
                  )}
                  {t.status === 'resolved' && (
                    <div className="ticket-resolution">
                      <CheckCircle2 size={14} />
                      <span>
                        Marked as completed{t.resolution?.byName ? ` by ${t.resolution.byName}` : ''}
                        {t.resolution?.note ? `: ${t.resolution.note}` : '.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
