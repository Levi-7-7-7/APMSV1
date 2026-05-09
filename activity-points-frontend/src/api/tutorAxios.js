import axios from 'axios';

// All tutor API calls go through this instance
const tutorAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach tutor JWT token to every request
tutorAxios.interceptors.request.use(config => {
  const token = localStorage.getItem('tutorToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout tutor on 401
tutorAxios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tutorToken');
      localStorage.removeItem('tutorName');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default tutorAxios;
