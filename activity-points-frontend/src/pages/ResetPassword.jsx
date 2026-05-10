import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This page is no longer used — password reset now happens inline on the ForgotPassword page via OTP.
// Any old reset-password links will be redirected to forgot-password.
export default function ResetPassword() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/forgot-password', { replace: true }); }, [navigate]);
  return null;
}
