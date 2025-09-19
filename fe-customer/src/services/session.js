import api from './api.js';

export const startSession = (payload) => api.post('/customer/sessions', payload);
export const fetchMenu = (sessionToken) => api.get('/customer/menu', { params: { sessionToken } });
export const placeCustomerOrder = (payload) => api.post('/customer/orders', payload);
export const fetchCustomerOrders = (sessionToken) => api.get('/customer/orders', { params: { sessionToken } });
