// Shared API helper functions
// These use axiosInstance which auto-attaches the correct auth token.

import axiosInstance from '../api/axiosInstance';
import tutorAxios from '../api/tutorAxios';

// Student-facing helpers
export const getCategories = () => axiosInstance.get('/categories');
export const getMyCertificates = () => axiosInstance.get('/certificates/my');
export const getMyProfile = () => axiosInstance.get('/students/me');
export const getDropdownData = () => axiosInstance.get('/students/dropdown-data');

// Tutor-facing helpers
export const getStudents = () => tutorAxios.get('/tutors/students');
export const getBatches = () => tutorAxios.get('/meta/batches');
export const getBranches = () => tutorAxios.get('/meta/branches');
export const getPendingCertificates = () => tutorAxios.get('/tutors/certificates/pending');
