import {
    startSession,
    getMenuForSession,
    placeOrderForSession,
    listOrdersForSession
} from '../services/customer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../../config/logger.js';

const extractSessionToken = (req) => req.body.sessionToken || req.query.sessionToken || req.headers['x-session-token'];

export const startSessionController = async (req, res) => {
    try {
        const result = await startSession(req.body);
        return successResponse(res, result, 201);
    } catch (error) {
        logger.error('Failed to start customer session', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};

export const getMenuController = async (req, res) => {
    try {
        const sessionToken = extractSessionToken(req);
        const menu = await getMenuForSession(sessionToken);
        return successResponse(res, menu, 200);
    } catch (error) {
        logger.error('Failed to fetch customer menu', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};

export const placeOrderController = async (req, res) => {
    try {
        const sessionToken = extractSessionToken(req);
        const result = await placeOrderForSession(sessionToken, req.body);
        return successResponse(res, result, 201);
    } catch (error) {
        logger.error('Failed to place customer order', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};

export const listOrdersController = async (req, res) => {
    try {
        const sessionToken = extractSessionToken(req);
        const orders = await listOrdersForSession(sessionToken);
        return successResponse(res, orders, 200);
    } catch (error) {
        logger.error('Failed to fetch customer orders', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};
