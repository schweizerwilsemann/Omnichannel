import {
    listRestaurants,
    getRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    getRestaurantsByOwner,
    updateRestaurantStatus
} from '../services/restaurant.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const extractPagination = (req) => ({
    page: parseInt(req.query?.page) || 1,
    pageSize: parseInt(req.query?.pageSize) || 20
});

export const listRestaurantsController = async (req, res) => {
    try {
        const data = await listRestaurants(extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load restaurants', 400);
    }
};

export const getRestaurantController = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const data = await getRestaurant(restaurantId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load restaurant', 400);
    }
};

export const createRestaurantController = async (req, res) => {
    try {
        const data = await createRestaurant(req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create restaurant', 400);
    }
};

export const updateRestaurantController = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const data = await updateRestaurant(restaurantId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update restaurant', 400);
    }
};

export const deleteRestaurantController = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const data = await deleteRestaurant(restaurantId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to delete restaurant', 400);
    }
};

export const getRestaurantsByOwnerController = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const data = await getRestaurantsByOwner(ownerId, extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load restaurants by owner', 400);
    }
};

export const updateRestaurantStatusController = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { status } = req.body;
        const data = await updateRestaurantStatus(restaurantId, status);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update restaurant status', 400);
    }
};

export default {
    listRestaurantsController,
    getRestaurantController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController,
    getRestaurantsByOwnerController,
    updateRestaurantStatusController
};
