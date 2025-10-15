import api from './api.js';

export const startSession = (payload) => api.post('/customer/sessions', payload);
export const fetchMenu = (sessionToken) => api.get('/customer/menu', { params: { sessionToken } });
export const placeCustomerOrder = (payload) => api.post('/customer/orders', payload);
export const fetchCustomerOrders = (sessionToken) => api.get('/customer/orders', { params: { sessionToken } });
export const requestMembershipVerification = (payload) => api.post('/customer/memberships/register', payload);
export const verifyMembershipToken = (params) => api.get('/customer/memberships/verify', { params });
export const getMembershipStatus = (params) => api.get('/customer/memberships/status', { params });
export const lookupTableBySlug = (qrSlug) => api.get('/customer/tables/lookup', { params: { qrSlug } });

export const openOrdersStream = (sessionToken) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }
    const baseUrl = (api.defaults.baseURL || '').replace(/\/+$/, '');
    const url = baseUrl + '/customer/orders/stream?sessionToken=' + encodeURIComponent(sessionToken);
    return new EventSource(url);
};

export const claimLoyaltyPoints = (payload) => api.post('/customer/memberships/claim', payload);
export const submitOrderRatings = (orderId, payload) => api.post(`/customer/orders/${orderId}/ratings`, payload);
export const closeSession = (params) => api.post('/customer/sessions/close', null, { params });