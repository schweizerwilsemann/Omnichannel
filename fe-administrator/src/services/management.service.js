import api from '../api/http.js';

export const fetchMenuCatalog = (params = {}) => api.get('/management/menu', { params });
export const createMenuItem = (payload) => api.post('/management/menu/items', payload);
export const updateMenuItem = (menuItemId, payload) => api.patch(`/management/menu/items/${menuItemId}`, payload);

export const fetchCustomers = (params = {}) => api.get('/management/customers', { params });
export const createCustomerMembership = (payload) => api.post('/management/customers', payload);
export const updateCustomerMembership = (membershipId, payload) =>
    api.patch(`/management/customers/${membershipId}`, payload);

export const fetchTables = (params = {}) => api.get('/management/tables', { params });
export const createTable = (payload) => api.post('/management/tables', payload);
export const updateTable = (tableId, payload) => api.patch(`/management/tables/${tableId}`, payload);

export default {
    fetchMenuCatalog,
    createMenuItem,
    updateMenuItem,
    fetchCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    fetchTables,
    createTable,
    updateTable
};
