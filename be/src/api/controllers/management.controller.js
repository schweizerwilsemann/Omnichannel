import {
    listMenuCategories,
    getMenuCategory,
    createMenuCategory,
    updateMenuCategory,
    deleteMenuCategory,
    listMenuCatalog,
    createMenuItem,
    updateMenuItem,
    createMenuCombo,
    updateMenuCombo,
    listCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    listTables,
    createTable,
    updateTable,
    listPromotions,
    getPromotion,
    createPromotion,
    updatePromotion,
    dispatchPromotionEmails
} from '../services/management.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const getRestaurantContext = (req) => req.user?.restaurantIds || [];
const extractPagination = (req) => ({
    page: parseInt(req.query?.page) || 1,
    pageSize: parseInt(req.query?.pageSize) || 20
});

// Menu Category Controllers
export const listMenuCategoriesController = async (req, res) => {
    try {
        const data = await listMenuCategories(getRestaurantContext(req), extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load menu categories', 400);
    }
};

export const getMenuCategoryController = async (req, res) => {
    try {
        const data = await getMenuCategory(getRestaurantContext(req), req.params.categoryId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load menu category', 400);
    }
};

export const createMenuCategoryController = async (req, res) => {
    try {
        const data = await createMenuCategory(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create menu category', 400);
    }
};

export const updateMenuCategoryController = async (req, res) => {
    try {
        const data = await updateMenuCategory(getRestaurantContext(req), req.params.categoryId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update menu category', 400);
    }
};

export const deleteMenuCategoryController = async (req, res) => {
    try {
        const data = await deleteMenuCategory(getRestaurantContext(req), req.params.categoryId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to delete menu category', 400);
    }
};

export const getMenuCatalogController = async (req, res) => {
    try {
        const data = await listMenuCatalog(getRestaurantContext(req), extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load menu catalog', 400);
    }
};

export const createMenuItemController = async (req, res) => {
    try {
        const data = await createMenuItem(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create menu item', 400);
    }
};

export const updateMenuItemController = async (req, res) => {
    try {
        const data = await updateMenuItem(getRestaurantContext(req), req.params.menuItemId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update menu item', 400);
    }
};

export const createMenuComboController = async (req, res) => {
    try {
        const data = await createMenuCombo(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create menu combo', 400);
    }
};

export const updateMenuComboController = async (req, res) => {
    try {
        const data = await updateMenuCombo(getRestaurantContext(req), req.params.comboId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update menu combo', 400);
    }
};

export const listCustomersController = async (req, res) => {
    try {
        const data = await listCustomers(getRestaurantContext(req), extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load customers', 400);
    }
};

export const createCustomerMembershipController = async (req, res) => {
    try {
        const data = await createCustomerMembership(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create customer membership', 400);
    }
};

export const updateCustomerMembershipController = async (req, res) => {
    try {
        const data = await updateCustomerMembership(getRestaurantContext(req), req.params.membershipId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update customer membership', 400);
    }
};

export const listTablesController = async (req, res) => {
    try {
        const data = await listTables(getRestaurantContext(req), extractPagination(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load tables', 400);
    }
};

export const createTableController = async (req, res) => {
    try {
        const data = await createTable(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create table', 400);
    }
};

export const updateTableController = async (req, res) => {
    try {
        const data = await updateTable(getRestaurantContext(req), req.params.tableId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update table', 400);
    }
};

export const listPromotionsController = async (req, res) => {
    try {
        const data = await listPromotions(getRestaurantContext(req));
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load promotions', 400);
    }
};

export const getPromotionController = async (req, res) => {
    try {
        const data = await getPromotion(getRestaurantContext(req), req.params.promotionId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to load promotion', 400);
    }
};

export const createPromotionController = async (req, res) => {
    try {
        const data = await createPromotion(getRestaurantContext(req), req.body);
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to create promotion', 400);
    }
};

export const updatePromotionController = async (req, res) => {
    try {
        const data = await updatePromotion(getRestaurantContext(req), req.params.promotionId, req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update promotion', 400);
    }
};

export const dispatchPromotionEmailsController = async (req, res) => {
    try {
        const data = await dispatchPromotionEmails(getRestaurantContext(req), req.params.promotionId);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to dispatch promotion emails', 400);
    }
};

export default {
    listMenuCategoriesController,
    getMenuCategoryController,
    createMenuCategoryController,
    updateMenuCategoryController,
    deleteMenuCategoryController,
    getMenuCatalogController,
    createMenuItemController,
    updateMenuItemController,
    createMenuComboController,
    updateMenuComboController,
    listCustomersController,
    createCustomerMembershipController,
    updateCustomerMembershipController,
    listTablesController,
    createTableController,
    updateTableController,
    listPromotionsController,
    getPromotionController,
    createPromotionController,
    updatePromotionController,
    dispatchPromotionEmailsController
};
