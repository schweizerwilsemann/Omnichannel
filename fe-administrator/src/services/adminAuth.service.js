import api from '../api/http.js';

export const login = (payload) => api.post('/admin/auth/login', payload);
export const refreshSession = (payload) => api.post('/admin/auth/refresh', payload);
export const logout = (payload) => api.post('/admin/auth/logout', payload);
export const createInvitation = (payload) => api.post('/admin/auth/invitations', payload);
export const acceptInvitation = (payload) => api.post('/admin/auth/invitations/accept', payload);
export const requestPasswordReset = (payload) =>
    api.post('/admin/auth/password-reset/request', payload);
export const resetPassword = (payload) => api.post('/admin/auth/password-reset/confirm', payload);
