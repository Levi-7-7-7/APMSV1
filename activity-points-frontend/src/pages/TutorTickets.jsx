import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Clock, CheckCircle2, ChevronDown, Loader2, Forward, Check, X, Inbox, Send,
  Image as ImageIcon,
} from 'lucide-react';
import {
  getTutorTicketInbox, getTutorOwnTickets, createTutorTicket,
  resolveTicketAsTutor, forwardTicketToAdmin, markTutorTicketSeen, markTutorTicketSeenNew,
} from '../utils/ticketApi';
import { getCached, setCached } from '../utils/pageDataCache';
import '../css/TutorTickets.css';

const CACHE_KEY = 'tutor-tickets';

function StatusBadge({ status, forwarded }) {
  if (status === 'resolved') {
    return <span className="tt-badge resolved"><CheckCircle2 size={13} /> Resolved</span>;
  }
  if (forwarded) {
    return <span className="tt-badge forwarded"><Forward size={13} /> With Admin</span>;
  }
  return <span className="tt-badge open"><Clock size={13} /> Open</span>;
}

export default function TutorTickets() {
  const { refreshTicketUnreadCount, refreshNewTicketCount, refreshToken } = useOutletContext() || {};
  const lastRefreshToken = useRef(refreshToken);
  const location = useLocation();
  const navigate = useNavigate();
  const [scope, setScope] = useState('inbox'); // 'inbox' | 'mine'
  const cached = getCached(CACHE_KEY);
  const [inbox, setInbox] = useState(cached?.inbox ?? []);
  const [mine, setMine] = useState(cached?.mine ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteMode, setNoteMode] = useState(null); // { id, kind: 'resolve' | 'forward' }
  const cardRefs = useRef({});

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  const loadInbox = async () => {
    const res = await getTutorTicketInbox();
    const next = res.data || [];
    setInbox(next);
    setCached(CACHE_KEY, { ...getCached(CACHE_KEY), inbox: next });
    return next;
  };
  const loadMine = async () => {
    const res = await getTutorOwnTickets();
    const next = res.data || [];
    setMine(next);
    setCached(CACHE_KEY, { ...getCached(CACHE_KEY), mine: next });
    return next;
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadInbox(), loadMine()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reuse cached data on a plain remount (e.g. tapping back to this tab);
    // only hit the network on first-ever load or when the global refresh
    // button bumps refreshToken.
    const isRefresh = refreshToken !== undefined && refreshToken !== lastRefreshToken.current;
    lastRefreshToken.current = refreshToken;
    const existing = getCached(CACHE_KEY);
    if (existing && !isRefresh) {
      setInbox(existing.inbox ?? []);
      setMine(existing.mine ?? []);
      setLoading(false);
      return;
    }
    loadAll();
  }, [refreshToken]);

  // Arrived here via a bell-icon notification about a new student ticket —
  // those always sit in the inbox, so switch there, then once it's loaded
  // expand it, scroll it into view, and mark it seen.
  const focusTicketId = location.state?.focusTicketId || null;

  useEffect(() => {
    if (focusTicketId) setScope('inbox');
  }, [focusTicketId]);

  useEffect(() => {
    if (!focusTicketId || loading) return;
    const target = inbox.find((t) => t._id === focusTicketId);
    if (!target) return;

    setExpandedId(focusTicketId);
    setTimeout(() => {
      cardRefs.current[focusTicketId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    if (target.tutorSeen === false) {
      updateInbox((prev) => prev.map((t) => (t._id === focusTicketId ? { ...t, tutorSeen: true } : t)));
      markTutorTicketSeenNew(focusTicketId).then(() => refreshNewTicketCount?.()).catch(() => {});
    }

    // Clear the router state so re-mounting this page (e.g. via the bottom
    // nav) doesn't keep re-triggering the same jump.
    navigate(location.pathname, { replace: true, state: {} });
  }, [focusTicketId, loading, inbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap setInbox/setMine so every local mutation (mark-seen, resolve,
  // forward, create) also updates the shared cache — otherwise switching
  // scope/tabs and back would show stale data until the next full load.
  const updateInbox = (updater) => {
    setInbox((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setCached(CACHE_KEY, { ...getCached(CACHE_KEY), inbox: next });
      return next;
    });
  };
  const updateMine = (updater) => {
    setMine((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setCached(CACHE_KEY, { ...getCached(CACHE_KEY), mine: next });
      return next;
    });
  };

  const openInboxCount = useMemo(
    () => inbox.filter((t) => t.status !== 'resolved').length,
    [inbox]
  );

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setFormError('Please fill in both subject and description.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      if (imageFile) formData.append('image', imageFile);

      const res = await createTutorTicket(formData);
      updateMine((prev) => [res.data, ...prev]);
      setSubject('');
      setDescription('');
      clearImage();
      setShowForm(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to raise request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = async (ticket) => {
    const opening = expandedId !== ticket._id;
    setExpandedId(opening ? ticket._id : null);
    setNoteMode(null);

    // Brand-new student ticket, not yet opened — clear the tutor bell badge.
    if (opening && ticket.raisedByModel === 'Student' && ticket.currentOwner === 'tutor' && ticket.tutorSeen === false) {
      try {
        await markTutorTicketSeenNew(ticket._id);
        updateInbox((prev) => prev.map((t) => (t._id === ticket._id ? { ...t, tutorSeen: true } : t)));
        refreshNewTicketCount?.();
      } catch (_) {}
    }

    // Own request or forwarded ticket, resolved and not yet seen — clear it.
    const isOwn = ticket.raisedByModel === 'Tutor';
    const isForwarder = ticket.forwardedBy && ticket.forwardedToAdmin;
    const unseen = (isOwn && ticket.raiserSeen === false) || (isForwarder && ticket.forwarderSeen === false);
    if (opening && ticket.status === 'resolved' && unseen) {
      try {
        await markTutorTicketSeen(ticket._id);
        const patch = (list) => list.map((t) => (t._id === ticket._id
          ? { ...t, raiserSeen: isOwn ? true : t.raiserSeen, forwarderSeen: isForwarder ? true : t.forwarderSeen }
          : t));
        updateInbox(patch);
        updateMine(patch);
        refreshTicketUnreadCount?.();
      } catch (_) {}
    }
  };

  const handleResolve = async (ticket) => {
    setActioningId(ticket._id);
    try {
      const res = await resolveTicketAsTutor(ticket._id, noteDraft.trim());
      updateInbox((prev) => prev.map((t) => (t._id === ticket._id ? res.data : t)));
      setNoteMode(null);
      setNoteDraft('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve ticket');
    } finally {
      setActioningId(null);
    }
  };

  const handleForward = async (ticket) => {
    setActioningId(ticket._id);
    try {
      const res = await forwardTicketToAdmin(ticket._id, noteDraft.trim());
      updateInbox((prev) => prev.map((t) => (t._id === ticket._id ? res.data : t)));
      setNoteMode(null);
      setNoteDraft('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to forward ticket');
    } finally {
      setActioningId(null);
    }
  };

  const list = scope === 'inbox' ? inbox : mine;

  return (
    <div className="tt-page">
      <div className="tt-scope-toggle">
        <button
          type="button"
          className={`tt-scope-btn ${scope === 'inbox' ? 'active' : ''}`}
          onClick={() => setScope('inbox')}
        >
          <Inbox size={15} /> Student Inbox
          {openInboxCount > 0 && <span className="tt-scope-count">{openInboxCount}</span>}
        </button>
        <button
          type="button"
          className={`tt-scope-btn ${scope === 'mine' ? 'active' : ''}`}
          onClick={() => setScope('mine')}
        >
          <Send size={15} /> My Requests
        </button>
      </div>

      {scope === 'mine' && (
        <div className="tt-new-wrap">
          <button type="button" className="tt-new-btn" onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> {showForm ? 'Cancel' : 'Raise a Request to Admin'}
          </button>

          {showForm && (
            <form className="tt-form" onSubmit={handleCreate}>
              <label className="tt-form-label">
                Subject
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  maxLength={150}
                />
              </label>
              <label className="tt-form-label">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the request in detail…"
                  rows={4}
                  maxLength={2000}
                />
              </label>
              <div className="tt-form-image">
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
                {imagePreview ? (
                  <div className="tt-image-preview">
                    <img src={imagePreview} alt="Attachment preview" />
                    <button type="button" className="tt-image-remove" onClick={clearImage} aria-label="Remove image">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="tt-image-add" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={16} /> Attach a photo (optional)
                  </button>
                )}
              </div>
              {formError && <div className="tt-form-error">{formError}</div>}
              <button type="submit" className="tt-form-submit" disabled={submitting}>
                {submitting ? <><Loader2 size={16} className="tt-spin" /> Submitting…</> : 'Submit Request'}
              </button>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="tt-empty">Loading tickets…</div>
      ) : error ? (
        <div className="tt-empty error">{error}</div>
      ) : list.length === 0 ? (
        <div className="tt-empty">
          {scope === 'inbox' ? 'No tickets from your students right now.' : "You haven't raised any requests yet."}
        </div>
      ) : (
        <div className="tt-list">
          {list.map((t) => {
            const isOwn = t.raisedByModel === 'Tutor';
            const isForwarder = t.forwardedBy && t.forwardedToAdmin;
            const unseenResolved = t.status === 'resolved' && (
              (isOwn && t.raiserSeen === false) || (isForwarder && t.forwarderSeen === false)
            );
            const isNew = scope === 'inbox' && t.currentOwner === 'tutor' && t.tutorSeen === false;
            const actionable = scope === 'inbox' && t.currentOwner === 'tutor' && t.status !== 'resolved';

            return (
              <div
                key={t._id}
                className={`tt-card ${(unseenResolved || isNew) ? 'unseen' : ''}`}
                ref={(el) => { cardRefs.current[t._id] = el; }}
              >
                <button type="button" className="tt-card-head" onClick={() => toggleExpand(t)}>
                  {isNew && <span className="tt-new-dot" aria-label="New ticket" />}
                  <div className="tt-card-head-text">
                    <span className="tt-subject">{t.subject}</span>
                    <span className="tt-meta">
                      {scope === 'inbox' ? t.raisedByName : 'You'} · {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <StatusBadge status={t.status} forwarded={t.forwardedToAdmin} />
                  <ChevronDown size={16} className={`tt-chevron ${expandedId === t._id ? 'open' : ''}`} />
                </button>

                {expandedId === t._id && (
                  <div className="tt-card-body">
                    <p className="tt-description">{t.description}</p>
                    {t.imageUrl && (
                      <a href={t.imageUrl} target="_blank" rel="noreferrer" className="tt-attachment-link">
                        <img src={t.imageUrl} alt="Ticket attachment" className="tt-attachment-img" />
                      </a>
                    )}
                    {t.forwardedToAdmin && (
                      <div className="tt-note">Forwarded to admin{t.forwardedBy?.name ? ` by ${t.forwardedBy.name}` : ''}.</div>
                    )}
                    {t.status === 'resolved' && (
                      <div className="tt-resolution">
                        <CheckCircle2 size={14} />
                        <span>
                          Marked as completed{t.resolution?.byName ? ` by ${t.resolution.byName}` : ''}
                          {t.resolution?.note ? `: ${t.resolution.note}` : '.'}
                        </span>
                      </div>
                    )}

                    {actionable && (
                      <div className="tt-actions">
                        {noteMode?.id === t._id ? (
                          <div className="tt-note-form">
                            <textarea
                              className="tt-note-input"
                              rows={2}
                              placeholder={noteMode.kind === 'resolve' ? 'Optional note for the student…' : 'Optional note for admin…'}
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                            />
                            <div className="tt-note-form-actions">
                              <button
                                type="button"
                                className="tt-btn-cancel"
                                onClick={() => { setNoteMode(null); setNoteDraft(''); }}
                              >
                                <X size={14} /> Cancel
                              </button>
                              <button
                                type="button"
                                className={noteMode.kind === 'resolve' ? 'tt-btn-resolve' : 'tt-btn-forward'}
                                disabled={actioningId === t._id}
                                onClick={() => (noteMode.kind === 'resolve' ? handleResolve(t) : handleForward(t))}
                              >
                                {actioningId === t._id
                                  ? <Loader2 size={14} className="tt-spin" />
                                  : (noteMode.kind === 'resolve' ? <Check size={14} /> : <Forward size={14} />)}
                                {noteMode.kind === 'resolve' ? 'Mark Resolved' : 'Forward to Admin'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="tt-btn-resolve"
                              onClick={() => { setNoteMode({ id: t._id, kind: 'resolve' }); setNoteDraft(''); }}
                            >
                              <Check size={14} /> Resolve
                            </button>
                            <button
                              type="button"
                              className="tt-btn-forward"
                              onClick={() => { setNoteMode({ id: t._id, kind: 'forward' }); setNoteDraft(''); }}
                            >
                              <Forward size={14} /> Forward to Admin
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
