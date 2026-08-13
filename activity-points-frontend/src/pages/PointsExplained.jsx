import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Layers,
  Trophy,
  Target,
  ChevronDown,
} from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { getCached, setCached, isSessionCached } from '../utils/pageDataCache';
import { getPointsBreakdown, passThreshold, PER_SEGMENT_CAP } from '../utils/calcPoints';
import '../css/PointsExplained.css';

// Same cache key CertificatesPage writes to — this page reads it for an
// instant paint (the two screens describe the same underlying data), and
// falls back to its own fetch if nothing's cached yet, e.g. the student
// lands here directly from a link before ever opening Certificates.
const CACHE_KEY = 'certificatesPage';

// Official source document this whole page is explaining — SBTE Kerala's
// Annexure 1, the same PDF every rule and cap below is drawn from.
const OFFICIAL_PDF_URL = 'https://sitttrkerala.ac.in/syllabus/rev2021/activity-rev2021.pdf';

export default function PointsExplained() {
  const navigate = useNavigate();

  const cached = getCached(CACHE_KEY);
  const [certificates, setCertificates] = useState(cached?.certificates ?? []);
  const [categories, setCategories]     = useState(cached?.categories ?? []);
  const [user, setUser]                 = useState(cached?.user ?? null);
  const [loading, setLoading]           = useState(!cached);
  const [error, setError]               = useState(null);

  useEffect(() => {
    // Same "trust the session cache, only hit the network once" pattern
    // as CertificatesPage — this page is read-only and has no refresh
    // button of its own, so it never needs to force a re-fetch.
    if (isSessionCached(CACHE_KEY) && cached) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [certRes, catRes, userRes] = await Promise.all([
          axiosInstance.get('/certificates/my'),
          axiosInstance.get('/categories'),
          axiosInstance.get('/students/me'),
        ]);
        const nextCertificates = certRes.data.certificates || [];
        const nextCategories = catRes.data.categories || [];
        const nextUser = userRes.data;
        setCertificates(nextCertificates);
        setCategories(nextCategories);
        setUser(nextUser);
        setCached(CACHE_KEY, { certificates: nextCertificates, categories: nextCategories, user: nextUser });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load your certificates');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLateral = user?.isLateralEntry ?? false;

  const breakdown = useMemo(() => {
    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    return getPointsBreakdown(approved, categories, isLateral)
      .sort((a, b) => b.raw - a.raw);
  }, [certificates, categories, isLateral]);

  const rawTotal = breakdown.reduce((s, c) => s + c.raw, 0);
  const countedTotal = breakdown.reduce((s, c) => s + c.counted, 0);
  const trimmed = rawTotal - countedTotal;

  return (
    <div className="pex-page">
      <div className="pex-hero">
        <button className="pex-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="pex-hero-title">How Points Are Calculated</h1>
      </div>

      <p className="pex-intro">
        Every certificate's points are added up and then capped following the
        official SBTE Kerala Activity Points rules — the same table your
        college HOD uses to verify your record. Here's exactly how those
        rules apply to your certificates.
      </p>

      <a
        className="pex-source-link"
        href={OFFICIAL_PDF_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileText size={18} />
        <span>
          <strong>Official source — SBTE Kerala, Annexure 1</strong>
          <small>Student Activity Points (Revision 2021 PDF)</small>
        </span>
        <ExternalLink size={16} className="pex-source-link-icon" />
      </a>

      {/* ---------- The rules, in plain language ---------- */}
      <p className="pex-section-label">THE RULES</p>
      <div className="pex-rules">
        <div className="pex-rule">
          <div className="pex-rule-icon"><Target size={18} /></div>
          <div>
            <p className="pex-rule-title">Minimum to pass</p>
            <p className="pex-rule-body">
              <strong>{passThreshold(false)} points</strong> for regular admission,{' '}
              <strong>{passThreshold(true)} points</strong> for lateral entry
              {user && (
                <> — <strong>you need {passThreshold(isLateral)}</strong> as
                  a {isLateral ? 'lateral entry' : 'regular'} student.</>
              )}
            </p>
          </div>
        </div>

        <div className="pex-rule">
          <div className="pex-rule-icon"><Layers size={18} /></div>
          <div>
            <p className="pex-rule-title">Per-segment cap</p>
            <p className="pex-rule-body">
              At most <strong>{PER_SEGMENT_CAP.regular} points</strong> from any single
              category count toward your total (<strong>{PER_SEGMENT_CAP.lateral}</strong> for
              lateral entry) — even if your certificates in that category add up to more.
              This stops one category from covering the whole requirement alone.
            </p>
          </div>
        </div>

        <div className="pex-rule">
          <div className="pex-rule-icon"><ChevronDown size={18} /></div>
          <div>
            <p className="pex-rule-title">Exceptions to that cap</p>
            <p className="pex-rule-body">
              A few categories have their own ceiling set directly in the PDF, higher
              or lower than the {PER_SEGMENT_CAP.regular}-point default:
            </p>
            <ul className="pex-rule-list">
              <li>NCC — up to <strong>50</strong> points</li>
              <li>NSS — up to <strong>50</strong> points</li>
              <li>Sports &amp; Games — up to <strong>30</strong> points</li>
              <li>Cultural Arts — up to <strong>30</strong> points</li>
              <li>Disaster Management — up to <strong>20</strong> points</li>
            </ul>
            <p className="pex-rule-body pex-rule-footnote">
              For lateral entry, the effective cap is whichever is lower: the category's
              own ceiling, or {PER_SEGMENT_CAP.lateral}.
            </p>
          </div>
        </div>

      </div>

      {/* ---------- Personalized breakdown ---------- */}
      <p className="pex-section-label">YOUR BREAKDOWN</p>

      {loading ? (
        <p className="pex-status-text">Loading your certificates…</p>
      ) : error ? (
        <p className="pex-status-text pex-status-error">{error}</p>
      ) : breakdown.length === 0 ? (
        <p className="pex-status-text">
          No approved certificates yet — once you have some, they'll show up here
          grouped by category with exactly how the cap applies to each.
        </p>
      ) : (
        <div className="pex-breakdown">
          {breakdown.map(cat => (
            <div key={cat.catId} className="pex-breakdown-row">
              <div className="pex-breakdown-row-top">
                <span className="pex-breakdown-name">{cat.name}</span>
                <span className="pex-breakdown-counted">{cat.counted} pts</span>
              </div>
              <div className="pex-breakdown-meta">
                {cat.certCount} certificate{cat.certCount !== 1 ? 's' : ''}
                {cat.isHighestOnly && ' · highest award only'}
                {' · raw '}{cat.raw}
                {' · cap '}{cat.cap}
                {cat.raw > cat.counted && (
                  <span className="pex-breakdown-trimmed"> · {cat.raw - cat.counted} trimmed</span>
                )}
              </div>
              <div className="pex-breakdown-bar-track">
                <div
                  className="pex-breakdown-bar-fill"
                  style={{ width: `${Math.min(100, (cat.counted / cat.cap) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="pex-breakdown-totals">
            <div>
              <p className="pex-totals-label">Raw total</p>
              <p className="pex-totals-value">{rawTotal}</p>
            </div>
            <div>
              <p className="pex-totals-label">Trimmed by caps</p>
              <p className="pex-totals-value pex-totals-trimmed">{trimmed > 0 ? `−${trimmed}` : 0}</p>
            </div>
            <div>
              <p className="pex-totals-label">Counted total</p>
              <p className="pex-totals-value pex-totals-final">{countedTotal}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
