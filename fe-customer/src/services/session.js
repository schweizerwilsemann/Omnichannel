import api from './api.js';

export const startSession = (payload) => api.post('/customer/sessions', payload);
export const fetchMenu = (sessionToken) => api.get('/customer/menu', { params: { sessionToken } });
export const placeCustomerOrder = (payload) => api.post('/customer/orders', payload);
export const fetchCustomerOrders = (sessionToken) => api.get('/customer/orders', { params: { sessionToken } });
export const requestMembershipVerification = (payload) => api.post('/customer/memberships/register', payload);
export const verifyMembershipToken = (params) => api.get('/customer/memberships/verify', { params });
export const getMembershipStatus = (params) => api.get('/customer/memberships/status', { params });
export const processCustomerPayment = (payload) => api.post('/customer/payments/charge', payload);
export const fetchPaymentIntent = (sessionToken, paymentIntentId) =>
    api.get(`/customer/payments/${paymentIntentId}`, { params: { sessionToken } });
export const lookupTableBySlug = (qrSlug) => api.get('/customer/tables/lookup', { params: { qrSlug } });
export const fetchCustomerPromotions = (sessionToken) =>
    api.get('/customer/promotions', { params: { sessionToken } });
export const fetchCustomerVouchers = (sessionToken) =>
    api.get('/customer/vouchers', { params: { sessionToken } });
export const claimCustomerVoucher = (payload) => api.post('/customer/vouchers/claim', payload);
export const claimVoucherByToken = (payload) => api.post('/customer/vouchers/email-claim', payload);
export const fetchCartRecommendations = (sessionToken, items = [], limit = 5) =>
    api.get('/customer/recommendations', {
        params: {
            sessionToken,
            items: Array.isArray(items) && items.length > 0 ? items.join(',') : undefined,
            limit
        }
    });

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

export const fetchActiveSession = (sessionToken) => api.get('/customer/sessions/active', { params: { sessionToken } });

export const requestLoginChallenge = (payload) => api.post('/customer/auth/login/challenge', payload);
export const verifyLoginChallenge = (payload) => api.post('/customer/auth/login/verify', payload);
export const fetchCustomerProfile = (sessionToken) => api.get('/customer/profile', { params: { sessionToken } });
export const startAuthenticatorSetup = (payload) => api.post('/customer/profile/authenticator/setup', payload);
export const confirmAuthenticatorSetup = (payload) => api.post('/customer/profile/authenticator/verify', payload);
export const disableAuthenticator = (sessionToken) =>
    api.delete('/customer/profile/authenticator', { params: { sessionToken } });
export const updateMembershipPin = (payload) => api.post('/customer/profile/pin', payload);

