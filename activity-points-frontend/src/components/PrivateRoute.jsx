// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // check both token and role
  if (!token || role !== 'student') {
    return <Navigate to="/" replace />;
  }

  return children;
}