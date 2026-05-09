import React, { useEffect, useState, useMemo } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { Award, Star } from 'lucide-react';
import '../css/StudentDashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/');

      try {
        const [userRes, certRes, catRes] = await Promise.all([
          axiosInstance.get('/students/me'),
          axiosInstance.get('/certificates/my'),
          axiosInstance.get('/categories'),
        ]);

        setUser(userRes.data);
        setCertificates(certRes.data.certificates || []);
        setCategories(catRes.data.categories || []);

        localStorage.setItem('userData', JSON.stringify(userRes.data));
        localStorage.setItem('userName', userRes.data.name);
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
  }, [navigate]);

  // Capped total — each category capped at its maxPoints (default 40)
  // Arts/Sports: only highest single award counts (no clubbing)
  const cappedTotal = useMemo(() => {
    if (!certificates.length || !categories.length) return 0;

    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');

    const grouped = approved.reduce((acc, cert) => {
      const catId = cert.category?._id || cert.category;
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(cert);
      return acc;
    }, {});

    let total = 0;
    Object.keys(grouped).forEach(catId => {
      const catData = categories.find(c => c._id === catId);
      if (!catData) return;

      const certs = grouped[catId];
      const name = catData.name.toLowerCase();

      const sum = (name.includes('arts') || name.includes('sports'))
        ? Math.max(...certs.map(c => c.pointsAwarded || 0), 0)
        : certs.reduce((s, c) => s + (c.pointsAwarded || 0), 0);

      total += Math.min(sum, catData.maxPoints || 40);
    });

    return total;
  }, [certificates, categories]);

  const PASS_POINTS = user?.isLateralEntry ? 40 : 60;
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
