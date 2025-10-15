import api from '../api/http.js';

export const fetchDashboardOverview = () => api.get('/admin/dashboard/overview');

export default {
    fetchDashboardOverview
};
