import { Op } from 'sequelize';
import models from '../models/index.js';
import logger from '../../config/logger.js';

const { Order, Restaurant, GuestSession, RestaurantTable, OrderItem, MenuItem } = models;

const ORDER_INCLUDES = [
    { model: Restaurant, as: 'restaurant' },
    {
        model: GuestSession,
        as: 'guestSession',
        include: [{ model: RestaurantTable, as: 'table' }]
    },
    {
        model: OrderItem,
        as: 'items',
        include: [{ model: MenuItem, as: 'menuItem' }]
    }
];

const toAdminOrder = (orderInstance) => {
    if (!orderInstance) {
        return null;
    }

    const order = orderInstance.get({ plain: true });

    return {
        id: order.id,
        shortCode: order.id.slice(0, 8).toUpperCase(),
        status: order.status,
        totalCents: order.totalCents,
        placedAt: order.placedAt,
        specialRequest: order.specialRequest,
        restaurant: order.restaurant
            ? {
                  id: order.restaurant.id,
                  name: order.restaurant.name
              }
            : null,
        table: order.guestSession?.table
            ? {
                  id: order.guestSession.table.id,
                  name: order.guestSession.table.name
              }
            : null,
        session: order.guestSession
            ? {
                  id: order.guestSession.id,
                  sessionToken: order.guestSession.sessionToken
              }
            : null,
        items: (order.items || []).map((item) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            name: item.menuItem?.name || null,
            quantity: item.quantity,
            priceCents: item.priceCentsSnapshot,
            notes: item.notes || null
        }))
    };
};

export const listOrdersForAdmin = async (restaurantIds = [], { status, limit = 50 } = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return [];
    }

    const where = {
        restaurantId: { [Op.in]: restaurantIds }
    };

    if (status) {
        where.status = status;
    }

    const orders = await Order.findAll({
        where,
        include: ORDER_INCLUDES,
        order: [['placedAt', 'DESC']],
        limit
    });

    return orders.map(toAdminOrder);
};

export const getOrderForAdmin = async (orderId, restaurantIds = []) => {
    const where = { id: orderId };
    if (Array.isArray(restaurantIds) && restaurantIds.length > 0) {
        where.restaurantId = { [Op.in]: restaurantIds };
    }

    const order = await Order.findOne({
        where,
        include: ORDER_INCLUDES
    });

    if (!order) {
        return null;
    }

    return toAdminOrder(order);
};

export const safeLoadOrderForEvent = async (orderId) => {
    try {
        const order = await Order.findByPk(orderId, {
            include: ORDER_INCLUDES
        });
        return toAdminOrder(order);
    } catch (error) {
        logger.warn('Failed to hydrate order for event dispatch', { message: error.message, orderId });
        return null;
    }
};
