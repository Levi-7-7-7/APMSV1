import React, { useEffect, useState, useMemo, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Award, Star } from 'lucide-react';
import '../css/StudentDashboard.css';
import { calcCappedPoints, passThreshold } from '../utils/calcPoints';
import { getCached, setCached } from '../utils/pageDataCache';

const CACHE_KEY = 'dashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { refreshToken } = useOutletContext() || {};
  const lastRefreshToken = useRef(refreshToken);

  const cached = getCached(CACHE_KEY);
  const [user, setUser] = useState(cached?.user ?? null);
  const [certificates, setCertificates] = useState(cached?.certificates ?? []);
  const [categories, setCategories] = useState(cached?.categories ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    // Reuse cached data on a plain remount (e.g. swiping back to this tab);
    // only hit the network on first-ever load or when the global refresh
    // button bumps refreshToken.
    const isRefresh = refreshToken !== undefined && refreshToken !== lastRefreshToken.current;
    lastRefreshToken.current = refreshToken;
    const existing = getCached(CACHE_KEY);
    if (existing && !isRefresh) {
      setUser(existing.user);
      setCertificates(existing.certificates);
      setCategories(existing.categories);
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/');

      setLoading(true);
      try {
        const [userRes, certRes, catRes] = await Promise.all([
          axiosInstance.get('/students/me'),
          axiosInstance.get('/certificates/my'),
          axiosInstance.get('/categories'),
        ]);

        const nextUser = userRes.data;
        const nextCertificates = certRes.data.certificates || [];
        const nextCategories = catRes.data.categories || [];

        setUser(nextUser);
        setCertificates(nextCertificates);
        setCategories(nextCategories);
        setCached(CACHE_KEY, { user: nextUser, certificates: nextCertificates, categories: nextCategories });

        localStorage.setItem('userData', JSON.stringify(nextUser));
        localStorage.setItem('userName', nextUser.name);
        // Notify same-tab listeners (StudentLayout) that userName is available
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        if (err.response?.status === 401) navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate, refreshToken]);

  // Capped total using correct SBTE Kerala rules (Rule 3 + Rule 6 + isLateralEntry)
  const cappedTotal = useMemo(() => {
    if (!certificates.length || !categories.length) return 0;
    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    return calcCappedPoints(approved, categories, user?.isLateralEntry ?? false);
  }, [certificates, categories, user]);

  const PASS_POINTS = passThreshold(user?.isLateralEntry);
  const hasPassed = cappedTotal >= PASS_POINTS;

  return (
    <>
      {/* Points Card */}
      <div className="points-card">
        <div className="points-info">
          <p>Activity Points</p>
          {loading ? <div className="skeleton skeleton-text" /> : <h2>{cappedTotal}</h2>}
        </div>
        <div className="award-icon">
          <Award size={32} color="#ca8a04" />
        </div>
      </div>

      {/* Pass badge */}
      {!loading && hasPassed && (
        <div className="pass-card">
          <div className="pass-left">
            <Award size={28} className="pass-icon" />
            <div>
              <h3>Activity Points Completed</h3>
              <p>You have successfully met the required activity points.</p>
            </div>
          </div>
          <div className="pass-right">
            <span className="pass-badge">PASSED</span>
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <section>
        <h3>Recent Activities</h3>
        <div className="activities-card">
          {loading ? (
            [1, 2, 3].map(n => (
              <div key={n} className="activity-row skeleton-row">
                <div className="skeleton skeleton-circle" />
                <div className="skeleton skeleton-line" />
              </div>
            ))
          ) : certificates.length === 0 ? (
            <p className="no-data">No activities yet. Upload your first certificate!</p>
          ) : (
            certificates.slice(0, 5).map(cert => (
              <div key={cert._id} className="activity-row">
                <div className="activity-left">
                  <Star size={20} color="#2563eb" />
                  <div className="activity-details">
                    <h4>{cert.subcategory}</h4>
                    <p>{new Date(cert.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="activity-right">
                  <p className="activity-points">+{cert.pointsAwarded || 0} pts</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
