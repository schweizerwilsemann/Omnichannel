import api from "../api/http.js";

// Restaurant API calls
export const fetchRestaurants = (params = {}) =>
  api.get("/restaurants", { params });

export const fetchRestaurantById = (restaurantId) =>
  api.get(`/restaurants/${restaurantId}`);

export const createRestaurant = (payload) =>
  api.post("/restaurants", payload);

export const updateRestaurant = (restaurantId, payload) =>
  api.patch(`/restaurants/${restaurantId}`, payload);

export const deleteRestaurant = (restaurantId) =>
  api.delete(`/restaurants/${restaurantId}`);

export const fetchRestaurantsByOwner = (ownerId, params = {}) =>
  api.get(`/restaurants/owner/${ownerId}`, { params });

export const updateRestaurantStatus = (restaurantId, payload) =>
  api.patch(`/restaurants/${restaurantId}/status`, payload);

export default {
  fetchRestaurants,
  fetchRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  fetchRestaurantsByOwner,
  updateRestaurantStatus,
};
