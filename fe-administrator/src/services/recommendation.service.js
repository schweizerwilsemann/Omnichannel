import api from '../api/http.js';

export const fetchRecommendationAnalytics = (params = {}) =>
    api.get('/admin/menu/recommendations', { params });

export default {
    fetchRecommendationAnalytics
};

