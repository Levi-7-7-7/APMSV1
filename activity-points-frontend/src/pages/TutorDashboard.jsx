import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TutorBottomNav from '../components/TutorBottomNav';
import '../css/TutorDashboard.css';

const TutorDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.split('/').pop(); // get last part of URL

  // Determine active tab
  const activeTab = React.useMemo(() => {
    return ['students', 'upload', 'pending', 'approved'].includes(path)
      ? path
      : 'students';
  }, [path]);

  // Get tutor name from localStorage
  const tutorName = localStorage.getItem('tutorName') || 'Tutor';

  // Logout handler with confirmation
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('tutorToken');
      localStorage.removeItem('tutorName');
      navigate('/'); // redirect to login
    }
  };

  // Avatar initials
  const avatarInitials = tutorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="tutor-dashboard p-4 pb-20">
      {/* Header */}
      <header className="dashboard-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="header-left flex items-center gap-3">
          <div className="tutor-avatar">
            <span>{avatarInitials}</span>
          </div>
          <div className="header-greeting">
            <h1>Welcome, {tutorName}!</h1>
            <p>Manage students, CSV uploads, and certificates below.</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-logout px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </header>

      {/* Nested pages */}
      <main className="nested-content min-h-[300px]">
        <React.Suspense fallback={<p className="loading-text">Loading...</p>}>
          <Outlet />
        </React.Suspense>
      </main>

      {/* Bottom navigation */}
      <TutorBottomNav activeTab={activeTab} />
    </div>
  );
};

export default TutorDashboard;
