import {
    listMenuCatalog,
    createMenuItem,
    updateMenuItem,
    listCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    listTables,
    createTable,
    updateTable
} from '../services/management.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const getRestaurantContext = (req) => req.user?.restaurantIds || [];
const extractPagination = (req) => ({
    page: req.query?.page,
    pageSize: req.query?.pageSize
});

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

export default {
    getMenuCatalogController,
    createMenuItemController,
    updateMenuItemController,
    listCustomersController,
    createCustomerMembershipController,
    updateCustomerMembershipController,
    listTablesController,
    createTableController,
    updateTableController
};
