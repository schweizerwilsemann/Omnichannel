import api from '../api/http.js';

export const fetchKnowledgeStatus = () => api.get('/admin/knowledge/status');

export const triggerKnowledgeSync = (payload = {}) =>
    api.post('/admin/knowledge/sync', payload);

export const flushChatCache = () => api.post('/admin/knowledge/cache/flush');
