import {
    startSession,
    getMenuForSession,
    placeOrderForSession,
    listOrdersForSession,
    requestMembershipVerification,
    verifyMembershipToken,
    getTableDetailsBySlug,
    getActiveSessionByToken
} from '../services/customer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../../config/logger.js';
import { registerCustomerOrderStream } from '../services/realtime.service.js';

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

export const lookupTableController = async (req, res) => {
    try {
        const record = await getTableDetailsBySlug(req.query.qrSlug);
        if (!record) {
            return errorResponse(res, 'Restaurant table not found', 404);
        }
        return successResponse(res, record, 200);
    } catch (error) {
        logger.error('Failed to look up table by QR slug', { message: error.message });
        return errorResponse(res, error.message || 'Unable to look up table information', 400);
    }
};

export const streamCustomerOrdersController = async (req, res) => {
    try {
        const sessionToken = extractSessionToken(req);
        const session = await getActiveSessionByToken(sessionToken);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
        });

        if (res.flushHeaders) {
            res.flushHeaders();
        }

        res.write('retry: 10000');
        registerCustomerOrderStream({ sessionToken: session.sessionToken, res });
    } catch (error) {
        logger.error('Failed to stream customer orders', { message: error.message });
        const statusCode = error.message === 'Session is not active' ? 403 : 400;
        return errorResponse(res, error.message || 'Unable to stream orders', statusCode);
    }
};

export const registerMembershipController = async (req, res) => {
    try {
        const result = await requestMembershipVerification(req.body);
        return successResponse(res, {
            message: 'Verification email sent',
            membershipStatus: result.membershipStatus,
            email: result.email,
            expiresAt: result.expiresAt
        }, 200);
    } catch (error) {
        logger.error('Failed to initiate membership verification', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};

export const verifyMembershipController = async (req, res) => {
    try {
        const result = await verifyMembershipToken(req.query);
        // If this request comes from a browser (no Accept: application/json) redirect
        const acceptsJson = req.headers.accept && req.headers.accept.indexOf('application/json') !== -1;
        if (!acceptsJson) {
            // Redirect to the customer app with a success fragment
            const customerBase = req.app?.get('customerAppUrl') || (process.env.CUSTOMER_APP_URL || process.env.APP_URL || 'http://localhost:3030');
            const redirectUrl = `${customerBase.replace(/\/+$/, '')}/?membershipVerified=true`;
            return res.redirect(302, redirectUrl);
        }

        return successResponse(res, {
            message: 'Membership verified',
            membershipStatus: result.membershipStatus
        }, 200);
    } catch (error) {
        logger.error('Failed to verify membership token', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};
export const claimLoyaltyPointsController = async (req, res) => {
    try {
        const result = await claimLoyaltyPoints(req.body.sessionToken, req.body.points);
        return successResponse(res, result, 200);
    } catch (error) {
        logger.error('Failed to claim loyalty points', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};

export const rateOrderItemsController = async (req, res) => {
    try {
        const sessionToken = extractSessionToken(req);
        const { orderId } = req.params;
        const result = await submitOrderRatings(sessionToken, orderId, req.body.ratings);
        return successResponse(res, result, 200);
    } catch (error) {
        logger.error('Failed to submit order ratings', { message: error.message });
        return errorResponse(res, error.message, 400);
    }
};
