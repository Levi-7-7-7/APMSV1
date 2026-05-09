import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

/* ===================== STUDENT PAGES ===================== */
import Login from './pages/Login';
import VerifyOtp from './pages/VerifyOtp';
import Dashboard from './pages/Dashboard';
import UploadCertificates from './pages/UploadCertificates';
import CertificatesPage from './pages/CertificatesPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import StudentLayout from './layouts/StudentLayout';

/* ===================== TUTOR PAGES ===================== */
import TutorDashboard from './pages/TutorDashboard';
import TutorPrivateRoute from './components/TutorPrivateRoute';
import StudentList from './pages/StudentList';
import StudentDetails from './pages/StudentDetails';
import UploadCSV from './pages/UploadCSV';
import PendingCertificates from './pages/PendingCertificates';
import ApprovedCertificates from './pages/ApprovedCertificates';

/* ===================== ADMIN PAGES ===================== */
import AdminPanel from './pages/AdminPanel';
import AdminPrivateRoute from './components/AdminPrivateRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public — single login page handles student, tutor, and admin */}
        <Route path="/" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
        </Route>

        {/* ===== TUTOR ===== */}
        <Route path="/tutor/dashboard" element={<TutorPrivateRoute><TutorDashboard /></TutorPrivateRoute>}>
          <Route index element={<h2 style={{padding:'1rem'}}>Welcome! Use the tabs below to navigate.</h2>} />
          <Route path="students" element={<StudentList />} />
          <Route path="students/:studentId" element={<StudentDetails />} />
          <Route path="upload" element={<UploadCSV />} />
          <Route path="pending" element={<PendingCertificates />} />
          <Route path="approved" element={<ApprovedCertificates />} />
        </Route>

        {/* ===== ADMIN ===== */}
        <Route path="/admin" element={<AdminPrivateRoute><AdminPanel /></AdminPrivateRoute>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
