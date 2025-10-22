import { Op } from 'sequelize';
import { verifyToken } from '../utils/jwt.js';
import { errorResponse, successResponse } from '../utils/response.js';
import { listOrdersForAdmin, getOrderForAdmin, safeLoadOrderForEvent } from '../services/order.service.js';
import { registerOrderStream, notifyOrderUpdated } from '../services/realtime.service.js';
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from '../utils/common.js';
import models from '../models/index.js';

const { Order } = models;

const resolveAdminPayload = (req, res) => {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        errorResponse(res, 'Authorization required', 401);
        return null;
    }

    try {
        return verifyToken(token);
    } catch (error) {
        errorResponse(res, error.message || 'Invalid token', 401);
        return null;
    }
};

export const listOrdersController = async (req, res) => {
    try {
        const { restaurantIds = [] } = req.user || {};
        if (!restaurantIds.length) {
            return successResponse(res, [], 200);
        }
        const { status, limit } = req.query;
        const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
        const orders = await listOrdersForAdmin(restaurantIds, { status, limit: parsedLimit });
        return successResponse(res, orders, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to list orders', 500);
    }
};

export const getOrderController = async (req, res) => {
    try {
        const { restaurantIds = [] } = req.user || {};
        if (!restaurantIds.length) {
            return errorResponse(res, 'No restaurant scope assigned', 403);
        }
        const order = await getOrderForAdmin(req.params.orderId, restaurantIds);
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }
        return successResponse(res, order, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to fetch order', 500);
    }
};

export const updateOrderStatusController = async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!status || !Object.values(ORDER_STATUS).includes(status)) {
            return errorResponse(res, 'Invalid order status', 400);
        }

        const { restaurantIds = [] } = req.user || {};
        if (!restaurantIds.length) {
            return errorResponse(res, 'No restaurant scope assigned', 403);
        }
        const where = { id: req.params.orderId };
        if (restaurantIds.length > 0) {
            where.restaurantId = { [Op.in]: restaurantIds };
        }

        const order = await Order.findOne({ where });
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }

        order.status = status;
        await order.save();

        const hydrated = await safeLoadOrderForEvent(order.id);
        if (hydrated) {
            notifyOrderUpdated(hydrated);
        }

        return successResponse(res, hydrated || { id: order.id, status: order.status }, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update order', 500);
    }
};

export const updateOrderPaymentController = async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!status || !Object.values(PAYMENT_STATUS).includes(status)) {
            return errorResponse(res, 'Invalid payment status', 400);
        }

        const { restaurantIds = [] } = req.user || {};
        if (!restaurantIds.length) {
            return errorResponse(res, 'No restaurant scope assigned', 403);
        }

        const where = { id: req.params.orderId };
        if (restaurantIds.length > 0) {
            where.restaurantId = { [Op.in]: restaurantIds };
        }

        const order = await Order.findOne({ where });
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }

        if (order.paymentMethod !== PAYMENT_METHOD.CASH && order.paymentMethod !== PAYMENT_METHOD.NONE) {
            return errorResponse(res, 'Only cashier-settled payments can be adjusted manually', 400);
        }

        if (status === PAYMENT_STATUS.SUCCEEDED) {
            order.paymentStatus = PAYMENT_STATUS.SUCCEEDED;
            order.paymentConfirmedAt = new Date();
            if (!order.paymentProvider) {
                order.paymentProvider = 'CASHIER';
            }
        } else {
            order.paymentStatus = PAYMENT_STATUS.PENDING;
            order.paymentConfirmedAt = null;
            if (order.paymentProvider === 'CASHIER') {
                order.paymentProvider = null;
            }
        }

        await order.save();

        const hydrated = await safeLoadOrderForEvent(order.id);
        if (hydrated) {
            notifyOrderUpdated(hydrated);
        }

        return successResponse(res, hydrated || { id: order.id, paymentStatus: order.paymentStatus }, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Unable to update payment status', 500);
    }
};

export const streamOrdersController = (req, res) => {
    const payload = resolveAdminPayload(req, res);
    if (!payload) {
        return;
    }

    const restaurants = Array.isArray(payload.restaurantIds) ? payload.restaurantIds : [];
    if (restaurants.length === 0) {
        errorResponse(res, 'No restaurant scope assigned', 403);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });

    if (res.flushHeaders) {
        res.flushHeaders();
    }

    res.write('retry: 10000\n\n');

    registerOrderStream({ restaurants, res });
};


