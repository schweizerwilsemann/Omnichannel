import { Op } from 'sequelize';
import models from '../models/index.js';
import logger from '../../config/logger.js';

const { Order, Restaurant, GuestSession, RestaurantTable, OrderItem, MenuItem, CustomerVoucher, Voucher, Promotion } = models;

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
    },
    {
        model: CustomerVoucher,
        as: 'customerVoucher',
        include: [
            { model: Voucher, as: 'voucher' },
            { model: Promotion, as: 'promotion' }
        ]
    }
];

const toAdminOrder = (orderInstance) => {
    if (!orderInstance) {
        return null;
    }

    const order = orderInstance.get({ plain: true });

    const customerVoucher = order.customerVoucher
        ? {
              id: order.customerVoucher.id,
              code: order.customerVoucher.code,
              status: order.customerVoucher.status,
              claimedAt: order.customerVoucher.claimedAt,
              redeemedAt: order.customerVoucher.redeemedAt,
              voucher: order.customerVoucher.voucher
                  ? {
                        id: order.customerVoucher.voucher.id,
                        code: order.customerVoucher.voucher.code,
                        name: order.customerVoucher.voucher.name
                    }
                  : null,
              promotion: order.customerVoucher.promotion
                  ? {
                        id: order.customerVoucher.promotion.id,
                        name: order.customerVoucher.promotion.name,
                        headline: order.customerVoucher.promotion.headline
                    }
                  : null
          }
        : null;

    return {
        id: order.id,
        shortCode: order.id.slice(0, 8).toUpperCase(),
        status: order.status,
        totalCents: order.totalCents,
        subtotalCents: order.totalCents + (order.discountAppliedCents || 0),
        discountAppliedCents: order.discountAppliedCents || 0,
        voucherDiscountCents: order.voucherDiscountCents || 0,
        loyaltyDiscountCents: order.loyaltyDiscountCents || 0,
        loyaltyPointsRedeemed: order.loyaltyPointsRedeemed || 0,
        earnedLoyaltyPoints: order.earnedLoyaltyPoints || 0,
        placedAt: order.placedAt,
        specialRequest: order.specialRequest,
        promotionId: order.promotionId || null,
        customerVoucher,
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
        payment: {
            status: order.paymentStatus || null,
            method: order.paymentMethod || null,
            provider: order.paymentProvider || null,
            intentId: order.paymentIntentId || null,
            reference: order.paymentReference || null,
            confirmedAt: order.paymentConfirmedAt || null,
            card: order.paymentMetadata?.cardLast4
                ? {
                      brand: order.paymentMetadata.cardBrand || null,
                      last4: order.paymentMetadata.cardLast4
                  }
                : null,
            instructions: order.paymentMetadata?.instructions || null
        },
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
