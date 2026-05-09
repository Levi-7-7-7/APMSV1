import React, { createContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const storedRole = localStorage.getItem('role');
        const token = localStorage.getItem(
          storedRole === 'student' ? 'token' : storedRole === 'tutor' ? 'tutorToken' : 'adminToken'
        );

        if (token && storedRole === 'student') {
          const res = await axiosInstance.get('/students/me');
          setUser(res.data);
          setRole('student');
        } else if (storedRole) {
          // For tutor/admin we trust the token — no /me endpoint needed
          setRole(storedRole);
        }
      } catch {
        // Token invalid — clear everything
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tutorToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('tutorName');
    localStorage.removeItem('userData');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, role, setRole, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
