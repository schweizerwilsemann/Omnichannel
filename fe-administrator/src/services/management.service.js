import api from "../api/http.js";

// Menu Category API calls
export const fetchMenuCategories = (params = {}) =>
  api.get("/management/menu/categories", { params });
export const fetchMenuCategoryById = (categoryId) =>
  api.get(`/management/menu/categories/${categoryId}`);
export const createMenuCategory = (payload) =>
  api.post("/management/menu/categories", payload);
export const updateMenuCategory = (categoryId, payload) =>
  api.patch(`/management/menu/categories/${categoryId}`, payload);
export const deleteMenuCategory = (categoryId) =>
  api.delete(`/management/menu/categories/${categoryId}`);

export const fetchMenuCatalog = (params = {}) =>
  api.get("/management/menu", { params });
export const createMenuItem = (payload) =>
  api.post("/management/menu/items", payload);
export const updateMenuItem = (menuItemId, payload) =>
  api.patch(`/management/menu/items/${menuItemId}`, payload);
export const createMenuCombo = (payload) =>
  api.post("/management/menu/combos", payload);
export const updateMenuCombo = (comboId, payload) =>
  api.patch(`/management/menu/combos/${comboId}`, payload);

export const fetchCustomers = (params = {}) =>
  api.get("/management/customers", { params });
export const createCustomerMembership = (payload) =>
  api.post("/management/customers", payload);
export const updateCustomerMembership = (membershipId, payload) =>
  api.patch(`/management/customers/${membershipId}`, payload);

export const fetchTables = (params = {}) =>
  api.get("/management/tables", { params });
export const createTable = (payload) => api.post("/management/tables", payload);
export const updateTable = (tableId, payload) =>
  api.patch(`/management/tables/${tableId}`, payload);

export const fetchPromotions = () => api.get("/management/promotions");
export const fetchPromotionById = (promotionId) =>
  api.get(`/management/promotions/${promotionId}`);
export const createPromotion = (payload) =>
  api.post("/management/promotions", payload);
export const updatePromotion = (promotionId, payload) =>
  api.patch(`/management/promotions/${promotionId}`, payload);
export const dispatchPromotionEmails = (promotionId) =>
  api.post(`/management/promotions/${promotionId}/dispatch`);

export default {
  fetchMenuCategories,
  fetchMenuCategoryById,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  fetchMenuCatalog,
  createMenuItem,
  updateMenuItem,
  createMenuCombo,
  updateMenuCombo,
  fetchCustomers,
  createCustomerMembership,
  updateCustomerMembership,
  fetchTables,
  createTable,
  updateTable,
  fetchPromotions,
  fetchPromotionById,
  createPromotion,
  updatePromotion,
  dispatchPromotionEmails,
};
