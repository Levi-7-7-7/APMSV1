// Shared ticket API helpers — thin wrappers around the three axios
// instances, mirroring the pattern in utils/api.js.
import axiosInstance from '../api/axiosInstance';
import tutorAxios from '../api/tutorAxios';
import adminAxios from '../api/adminAxios';

// ── Student ──────────────────────────────────────────────────────────────
export const createStudentTicket = (formData) =>
  axiosInstance.post('/tickets/student', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getMyTickets = () => axiosInstance.get('/tickets/student/my');
export const markStudentTicketSeen = (id) => axiosInstance.patch(`/tickets/student/${id}/seen`);
export const getStudentTicketUnreadCount = () => axiosInstance.get('/tickets/student/unread-count');

// ── Tutor ────────────────────────────────────────────────────────────────
export const getTutorTicketInbox = () => tutorAxios.get('/tickets/tutor');
export const getTutorOwnTickets = () => tutorAxios.get('/tickets/tutor?scope=mine');
export const createTutorTicket = (data) => tutorAxios.post('/tickets/tutor', data);
export const resolveTicketAsTutor = (id, note) => tutorAxios.patch(`/tickets/tutor/${id}/resolve`, { note });
export const forwardTicketToAdmin = (id, note) => tutorAxios.patch(`/tickets/tutor/${id}/forward`, { note });
export const markTutorTicketSeen = (id) => tutorAxios.patch(`/tickets/tutor/${id}/seen`);
export const getTutorTicketUnreadCount = () => tutorAxios.get('/tickets/tutor/unread-count');

// ── Admin ────────────────────────────────────────────────────────────────
export const getAdminTicketQueue = (status) =>
  adminAxios.get('/tickets/admin', { params: status ? { status } : {} });
export const resolveTicketAsAdmin = (id, note) => adminAxios.patch(`/tickets/admin/${id}/resolve`, { note });
export const getAdminTicketUnreadCount = () => adminAxios.get('/tickets/admin/unread-count');
export const getAdminTicketNotifications = () => adminAxios.get('/tickets/admin/notifications');
export const markAdminTicketSeen = (id) => adminAxios.patch(`/tickets/admin/${id}/seen`);
