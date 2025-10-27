import { Op } from 'sequelize';
import models from '../models/index.js';
import { getDashboardSummary } from '../services/dashboard.service.js';
import { listRecommendationAnalytics } from '../services/recommendation.service.js';
import { getRagSyncStatus, syncRagKnowledge, flushRagCache } from '../services/ragSync.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../../config/logger.js';
import { notifySessionClosed } from '../services/realtime.service.js';
import { ORDER_STATUS } from '../utils/common.js';

const { GuestSession, RestaurantTable, Restaurant, Order, Customer } = models;

const ACTIVE_ORDER_STATUSES = new Set([
    ORDER_STATUS.PLACED,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.IN_PREP,
    ORDER_STATUS.READY
]);

const getTimeValue = (value) => {
    if (!value) {
        return null;
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
};

const toActiveTablePayload = (sessionInstance) => {
    const session = sessionInstance.get({ plain: true });
    const orders = session.orders || [];
    const openOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status));
    const lastOrderTimestamp = orders
        .map((order) => Math.max(getTimeValue(order.updatedAt) ?? 0, getTimeValue(order.placedAt) ?? 0))
        .filter((value) => value > 0);
    const lastOrderAt = lastOrderTimestamp.length > 0 ? new Date(Math.max(...lastOrderTimestamp)).toISOString() : null;

    return {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        startedAt: session.startedAt,
        membershipStatus: session.membershipStatus,
        restaurant: session.restaurant
            ? {
                  id: session.restaurant.id,
                  name: session.restaurant.name
              }
            : null,
        table: session.table
            ? {
                  id: session.table.id,
                  name: session.table.name,
                  status: session.table.status,
                  capacity: session.table.capacity
              }
            : null,
        guest: {
            firstName: session.customer?.firstName ?? session.customerMeta?.firstName ?? null,
            lastName: session.customer?.lastName ?? session.customerMeta?.lastName ?? null,
            email: session.customer?.email ?? session.customerMeta?.email ?? null,
            phoneNumber: session.customer?.phoneNumber ?? session.customerMeta?.phoneNumber ?? null
        },
        customerId: session.customer?.id ?? null,
        orderSummary: {
            totalOrders: orders.length,
            openOrders: openOrders.length,
            lastOrderAt
        }
    };
};

export const listActiveTablesController = async (req, res) => {
    try {
        const restaurantIds = req.user?.restaurantIds || [];
        if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
            return successResponse(res, [], 200);
        }

        const sessions = await GuestSession.findAll({
            where: {
                restaurantId: { [Op.in]: restaurantIds },
                closedAt: null
            },
            include: [
                { model: RestaurantTable, as: 'table' },
                { model: Restaurant, as: 'restaurant' },
                { model: Customer, as: 'customer', required: false },
                {
                    model: Order,
                    as: 'orders',
                    required: false,
                    attributes: ['id', 'status', 'placedAt', 'updatedAt', 'totalCents']
                }
            ],
            order: [['startedAt', 'ASC']]
        });

        const payload = sessions.map(toActiveTablePayload);
        return successResponse(res, payload, 200);
    } catch (error) {
        logger.error('Failed to list active tables', { message: error.message });
        return errorResponse(res, error.message || 'Unable to fetch active tables', 400);
    }
};

export const closeGuestSessionController = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return errorResponse(res, 'Session id is required', 400);
        }

        const session = await GuestSession.findByPk(sessionId);
        if (!session) {
            return errorResponse(res, 'Guest session not found', 404);
        }

        if (session.closedAt) {
            return successResponse(res, { message: 'Session already closed' }, 200);
        }

        await session.update({ closedAt: new Date() });

        logger.info('Guest session closed by admin', { sessionId });

        try {
            notifySessionClosed(session.sessionToken, {
                sessionId: session.id,
                qrSlug: session.restaurantTableId ? undefined : undefined
            });
        } catch (e) {
            logger.debug('Failed to notify session closed', { message: e.message });
        }

        return successResponse(res, { message: 'Session closed' }, 200);
    } catch (error) {
        logger.error('Failed to close guest session', { message: error.message });
        return errorResponse(res, error.message || 'Unable to close session', 400);
    }
};

export const getDashboardOverviewController = async (req, res) => {
    try {
        const restaurantIds = req.user?.restaurantIds || [];
        const summary = await getDashboardSummary(restaurantIds);
        return successResponse(res, summary, 200);
    } catch (error) {
        logger.error('Failed to load dashboard overview', { message: error.message });
        return errorResponse(res, error.message || 'Unable to load dashboard overview', 400);
    }
};

export const listMenuRecommendationsController = async (req, res) => {
    try {
        const restaurantIds = req.user?.restaurantIds || [];
        const parseNumeric = (value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        };
        const options = {
            restaurantId: req.query.restaurantId || undefined,
            minAttachRate: parseNumeric(req.query.minAttachRate),
            limit: parseNumeric(req.query.limit),
            page: parseNumeric(req.query.page),
            trendWindowDays: parseNumeric(req.query.trendWindowDays)
        };
        const analytics = await listRecommendationAnalytics(restaurantIds, options);
        return successResponse(res, analytics, 200);
    } catch (error) {
        logger.error('Failed to load recommendation analytics', { message: error.message });
        return errorResponse(res, error.message || 'Unable to load recommendation analytics', 400);
    }
};

export const getKnowledgeStatusController = async (_req, res) => {
    try {
        const status = getRagSyncStatus();
        return successResponse(res, status, 200);
    } catch (error) {
        logger.error('Failed to fetch knowledge sync status', { message: error.message });
        return errorResponse(res, error.message || 'Unable to load status', 400);
    }
};

export const triggerKnowledgeSyncController = async (req, res) => {
    try {
        const restaurantIds = Array.isArray(req.user?.restaurantIds) ? req.user.restaurantIds : [];
        const { flushCache = true } = req.body || {};
        const summary = await syncRagKnowledge({
            restaurantIds,
            flushCache: Boolean(flushCache)
        });
        return successResponse(res, summary, 202);
    } catch (error) {
        logger.error('Knowledge sync failed', { message: error.message });
        return errorResponse(res, error.message || 'Unable to sync knowledge', error.message?.includes('running') ? 409 : 400);
    }
};

export const flushKnowledgeCacheController = async (_req, res) => {
    try {
        const result = await flushRagCache();
        return successResponse(res, result, 200);
    } catch (error) {
        logger.error('Failed to flush knowledge cache', { message: error.message });
        return errorResponse(res, error.message || 'Unable to flush cache', 400);
    }
};

export default {
    listActiveTablesController,
    closeGuestSessionController,
    getDashboardOverviewController,
    listMenuRecommendationsController,
    getKnowledgeStatusController,
    triggerKnowledgeSyncController,
    flushKnowledgeCacheController
};


