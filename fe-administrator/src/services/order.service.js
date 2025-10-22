import api from '../api/http.js';

export const fetchOrders = (params) => api.get('/orders', { params });
export const fetchOrder = (orderId) => api.get(`/orders/${orderId}`);
export const updateOrderStatus = (orderId, payload) => api.patch(`/orders/${orderId}`, payload);
export const updateOrderPaymentStatus = (orderId, payload) => api.patch(`/orders/${orderId}/payment`, payload);
export const fetchKdsTickets = (params) => api.get('/kds/tickets', { params });
export const updateKdsTicket = (ticketId, payload) => api.patch(`/kds/tickets/${ticketId}`, payload);
