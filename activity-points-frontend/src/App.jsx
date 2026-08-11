import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoader from './components/RouteLoader';
import PrivateRoute from './components/PrivateRoute';
import TutorPrivateRoute from './components/TutorPrivateRoute';
import AdminPrivateRoute from './components/AdminPrivateRoute';
import StudentLayout from './layouts/StudentLayout';

/* ===================== EAGER (needed for first paint / route guards) ===================== */
import Login from './pages/Login';

// StudentLayout mounts these three directly for its WhatsApp-style
// swipeable tab pager (see layouts/StudentLayout.jsx), not through
// <Outlet/>. That means they're already in the main bundle regardless of
// what App.jsx does with them, so lazy-wrapping them here only adds a
// second, redundant chunk and a "dynamic + static import" build warning
// with zero savings. The <Route> entries below still need a real element
// for react-router's matching, even though StudentLayout never actually
// renders them through Outlet for these three paths.
import Dashboard from './pages/Dashboard';
import UploadCertificates from './pages/UploadCertificates';
import CertificatesPage from './pages/CertificatesPage';

/* ===================== LAZY — STUDENT ===================== */
const Tickets = lazy(() => import('./pages/Tickets'));
const Profile = lazy(() => import('./pages/Profile'));
const AppearanceSettings = lazy(() => import('./pages/AppearanceSettings'));
const PointsExplained = lazy(() => import('./pages/PointsExplained'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

/* ===================== LAZY — TUTOR ===================== */
const TutorDashboard = lazy(() => import('./pages/TutorDashboard'));
const StudentDetails = lazy(() => import('./pages/StudentDetails'));
const TutorTickets = lazy(() => import('./pages/TutorTickets'));

const TutorForgotPassword = lazy(() => import('./pages/TutorForgotPassword'));
const TutorProfile = lazy(() => import('./pages/TutorProfile'));

/* ===================== LAZY — ADMIN ===================== */
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminForgotPassword = lazy(() => import('./pages/AdminForgotPassword'));

/* ===================== LAZY — FALLBACK ===================== */
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return (
    // Top-level safety net: if any page throws during render, this shows a
    // calm "Something went wrong" screen with a reload button instead of a
    // blank white page. See components/ErrorBoundary.jsx.
    <ErrorBoundary>
      <BrowserRouter>
        {/* One Suspense boundary for every lazy route below — RouteLoader
            only paints a spinner if a chunk takes a while, so cached/fast
            navigations never flash a loading state. */}
        <Suspense fallback={<RouteLoader />}>
          <Routes>

            {/* Public — single login page handles student, tutor, and admin */}
            <Route path="/" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/tutor/forgot-password" element={<TutorForgotPassword />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />

            {/* Legacy URL redirects */}
            <Route path="/dashboard" element={<Navigate to="/student" replace />} />
            <Route path="/upload-certificate" element={<Navigate to="/student/upload-certificate" replace />} />
            <Route path="/certificates" element={<Navigate to="/student/certificates" replace />} />
            <Route path="/tutor/login" element={<Navigate to="/" replace />} />
            <Route path="/admin/login" element={<Navigate to="/" replace />} />

            {/* ===== STUDENT ===== */}
            <Route path="/student" element={<PrivateRoute><StudentLayout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="upload-certificate" element={<UploadCertificates />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="profile" element={<Profile />} />
              <Route path="appearance" element={<AppearanceSettings />} />
              <Route path="points-explained" element={<PointsExplained />} />
            </Route>

            {/* ===== TUTOR ===== */}
            <Route path="/tutor/dashboard" element={<TutorPrivateRoute><TutorDashboard /></TutorPrivateRoute>}>
              <Route index element={<h2 style={{padding:'1rem'}}>Welcome! Use the tabs below to navigate.</h2>} />

              {/* TutorDashboard.jsx statically imports StudentList/UploadCSV/
                  PendingCertificates/ApprovedCertificates directly for its own
                  swipeable tab pager and never renders <Outlet/> for these
                  exact paths, so these four route elements are unreachable —
                  kept as `null` rather than importing the real components a
                  second time. TutorDashboard is itself lazy-loaded; importing
                  them here (static or dynamic) would drag jspdf/html2canvas
                  back out of its chunk and toward the main bundle, undoing
                  the point of splitting it out. */}
              <Route path="students" element={null} />
              <Route path="students/:studentId" element={<StudentDetails />} />
              <Route path="upload" element={null} />
              <Route path="pending" element={null} />
              <Route path="approved" element={null} />
              <Route path="tickets" element={<TutorTickets />} />
              <Route path="profile" element={<TutorProfile />} />
              <Route path="appearance" element={<AppearanceSettings />} />
            </Route>

            {/* ===== ADMIN ===== */}
            <Route path="/admin" element={<AdminPrivateRoute><AdminPanel /></AdminPrivateRoute>} />

            {/* ===== FALLBACK — any unmatched URL, instead of a blank page ===== */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
