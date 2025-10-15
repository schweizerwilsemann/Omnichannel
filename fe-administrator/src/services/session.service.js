import api from '../api/http.js';

export const listActiveTables = () => api.get('/admin/tables/active');
export const closeGuestSession = (sessionId) => api.post(`/admin/sessions/${sessionId}/close`);

export default {
    listActiveTables,
    closeGuestSession
};
