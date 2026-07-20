import React, { useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle2, ChevronDown, Loader2, Check, X, Forward } from 'lucide-react';
import { getAdminTicketQueue, resolveTicketAsAdmin, markAdminTicketSeen } from '../utils/ticketApi';
import '../css/AdminTickets.css';

function StatusBadge({ status }) {
  return status === 'resolved' ? (
    <span className="adt-badge resolved"><CheckCircle2 size={13} /> Resolved</span>
  ) : (
    <span className="adt-badge open"><Clock size={13} /> Open</span>
  );
}

export default function AdminTickets({ flash, focusTicketId, onFocusHandled, onSeenChange }) {
  const [statusFilter, setStatusFilter] = useState('open'); // 'open' | 'resolved'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [noteMode, setNoteMode] = useState(null); // ticket id currently being resolved with a note
  const [noteDraft, setNoteDraft] = useState('');
  const cardRefs = useRef({});

  const load = async (status) => {
    setLoading(true);
    try {
      const res = await getAdminTicketQueue(status);
      setTickets(res.data || []);
    } catch (err) {
      flash?.(err.response?.data?.error || 'Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  // Arrived here via a bell-icon notification — new tickets are always
  // still open, so make sure we're looking at the right queue.
  useEffect(() => {
    if (focusTicketId && statusFilter !== 'open') setStatusFilter('open');
  }, [focusTicketId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the notified ticket shows up in the loaded list, expand it,
  // scroll it into view, and mark it seen so the badge clears.
  useEffect(() => {
    if (!focusTicketId || loading) return;
    const target = tickets.find((t) => t._id === focusTicketId);
    if (!target) { onFocusHandled?.(); return; }

    setExpandedId(focusTicketId);
    setTickets((prev) => prev.map((t) => (t._id === focusTicketId ? { ...t, adminSeen: true } : t)));
    setTimeout(() => {
      cardRefs.current[focusTicketId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    markAdminTicketSeen(focusTicketId).then(() => onSeenChange?.()).catch(() => {});
    onFocusHandled?.();
  }, [focusTicketId, loading, tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (id, ticket) => {
    const opening = expandedId !== id;
    setExpandedId((prev) => (prev === id ? null : id));
    setNoteMode(null);

    if (opening && ticket?.adminSeen === false) {
      setTickets((prev) => prev.map((t) => (t._id === id ? { ...t, adminSeen: true } : t)));
      markAdminTicketSeen(id).then(() => onSeenChange?.()).catch(() => {});
    }
  };

  const handleResolve = async (ticket) => {
    setActioningId(ticket._id);
    try {
      await resolveTicketAsAdmin(ticket._id, noteDraft.trim());
      setTickets((prev) => prev.filter((t) => t._id !== ticket._id));
      setNoteMode(null);
      setNoteDraft('');
      flash?.('Ticket resolved');
    } catch (err) {
      flash?.(err.response?.data?.error || 'Failed to resolve ticket', 'error');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div className="ap-card" id="sf-tickets" style={{ marginBottom: '1.5rem' }}>
        <div className="ap-card-header">
          <div className="ap-card-icon amber"><Forward size={16} /></div>
          <h3>Tickets <span style={{ color: 'var(--ap-muted)', fontWeight: 400 }}>({tickets.length})</span></h3>
        </div>
        <div className="ap-card-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--ap-muted)', marginBottom: '1rem' }}>
            Requests forwarded to you by tutors, plus tutors' own requests raised directly to admin.
          </p>

          <div className="adt-status-toggle">
            <button
              type="button"
              className={`adt-status-btn ${statusFilter === 'open' ? 'active' : ''}`}
              onClick={() => setStatusFilter('open')}
            >
              Open
            </button>
            <button
              type="button"
              className={`adt-status-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('resolved')}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ap-empty">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="ap-empty">
          {statusFilter === 'open' ? 'Nothing in your queue right now.' : 'No resolved tickets yet.'}
        </div>
      ) : (
        <div className="adt-list">
          {tickets.map((t) => (
            <div
              key={t._id}
              className={`ap-card adt-card ${t.adminSeen === false ? 'unseen' : ''}`}
              ref={(el) => { cardRefs.current[t._id] = el; }}
            >
              <button type="button" className="adt-card-head" onClick={() => toggleExpand(t._id, t)}>
                {t.adminSeen === false && <span className="adt-new-dot" aria-label="New ticket" />}
                <div className="adt-card-head-text">
                  <span className="adt-subject">{t.subject}</span>
                  <span className="adt-meta">
                    {t.raisedByName} ({t.raisedByRole}) · {new Date(t.createdAt).toLocaleDateString()}
                    {t.forwardedBy?.name ? ` · forwarded by ${t.forwardedBy.name}` : ''}
                  </span>
                </div>
                <StatusBadge status={t.status} />
                <ChevronDown size={16} className={`adt-chevron ${expandedId === t._id ? 'open' : ''}`} />
              </button>

              {expandedId === t._id && (
                <div className="adt-card-body">
                  <p className="adt-description">{t.description}</p>
                  {t.imageUrl && (
                    <a href={t.imageUrl} target="_blank" rel="noreferrer" className="adt-attachment-link">
                      <img src={t.imageUrl} alt="Ticket attachment" className="adt-attachment-img" />
                    </a>
                  )}
                  {t.forwardNote && (
                    <div className="adt-note">Tutor's note: {t.forwardNote}</div>
                  )}
                  {t.status === 'resolved' && (
                    <div className="adt-resolution">
                      <CheckCircle2 size={14} />
                      <span>
                        Marked as completed{t.resolution?.byName ? ` by ${t.resolution.byName}` : ''}
                        {t.resolution?.note ? `: ${t.resolution.note}` : '.'}
                      </span>
                    </div>
                  )}

                  {statusFilter === 'open' && t.status !== 'resolved' && (
                    <div className="adt-actions">
                      {noteMode === t._id ? (
                        <div className="adt-note-form">
                          <textarea
                            className="adt-note-input"
                            rows={2}
                            placeholder="Optional note for whoever raised this…"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                          />
                          <div className="adt-note-form-actions">
                            <button
                              type="button"
                              className="adt-btn-cancel"
                              onClick={() => { setNoteMode(null); setNoteDraft(''); }}
                            >
                              <X size={14} /> Cancel
                            </button>
                            <button
                              type="button"
                              className="adt-btn-resolve"
                              disabled={actioningId === t._id}
                              onClick={() => handleResolve(t)}
                            >
                              {actioningId === t._id ? <Loader2 size={14} className="adt-spin" /> : <Check size={14} />}
                              Mark Resolved
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="adt-btn-resolve"
                          onClick={() => { setNoteMode(t._id); setNoteDraft(''); }}
                        >
                          <Check size={14} /> Resolve
                        </button>
                      )}
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
