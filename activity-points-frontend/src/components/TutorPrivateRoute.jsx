import React from 'react';
import { Navigate } from 'react-router-dom';

export default function TutorPrivateRoute({ children }) {
  const token = localStorage.getItem('tutorToken');
  // Redirect to main login page (not /tutor/login which is the same component)
  return token ? children : <Navigate to="/" replace />;
}
