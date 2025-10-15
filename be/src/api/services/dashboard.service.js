import { Op, fn, col, literal } from 'sequelize';
import models from '../models/index.js';
import { ORDER_STATUS } from '../utils/common.js';

const {
    sequelize,
    Order,
    OrderItem,
    GuestSession,
    MenuItem
} = models;

const toSafeInteger = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildEmptySummary = () => ({
    totals: {
        ordersToday: 0,
        completedOrdersToday: 0,
        revenueTodayCents: 0,
        averageOrderValueTodayCents: 0,
        activeGuestSessions: 0
    },
    orderStatusDistribution: [],
    revenueTrend: [],
    topMenuItems: []
});

const buildDateKey = (date) => date.toISOString().slice(0, 10);

export const getDashboardSummary = async (restaurantIds = []) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return buildEmptySummary();
    }

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(startOfToday.getDate() - 6);

    const whereRestaurant = { restaurantId: { [Op.in]: restaurantIds } };

    const [ordersTodayCount, completedTodayCount, revenueTodayRow, activeSessionsCount, statusRows, trendRows, topItemsRows] = await Promise.all([
        Order.count({
            where: {
                ...whereRestaurant,
                placedAt: { [Op.gte]: startOfToday }
            }
        }),
        Order.count({
            where: {
                ...whereRestaurant,
                status: ORDER_STATUS.COMPLETED,
                completedAt: { [Op.gte]: startOfToday }
            }
        }),
        Order.findOne({
            attributes: [[fn('COALESCE', fn('SUM', col('total_cents')), 0), 'revenueTodayCents']],
            where: {
                ...whereRestaurant,
                placedAt: { [Op.gte]: startOfToday }
            },
            raw: true
        }),
        GuestSession.count({
            where: {
                restaurantId: { [Op.in]: restaurantIds },
                closedAt: null
            }
        }),
        Order.findAll({
            attributes: ['status', [fn('COUNT', col('id')), 'orderCount']],
            where: {
                ...whereRestaurant,
                placedAt: { [Op.gte]: sevenDaysAgo }
            },
            group: ['status'],
            raw: true
        }),
        Order.findAll({
            attributes: [
                [literal('DATE(placed_at)'), 'bucketDate'],
                [fn('SUM', col('total_cents')), 'revenueCents'],
                [fn('COUNT', col('id')), 'orderCount']
            ],
            where: {
                ...whereRestaurant,
                placedAt: { [Op.gte]: sevenDaysAgo }
            },
            group: [literal('DATE(placed_at)')],
            order: [[literal('DATE(placed_at)'), 'ASC']],
            raw: true
        }),
        OrderItem.findAll({
            attributes: [
                'menuItemId',
                [fn('SUM', col('quantity')), 'totalQuantity'],
                [fn('SUM', literal('quantity * price_cents_snapshot')), 'totalRevenueCents']
            ],
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [],
                    where: {
                        ...whereRestaurant,
                        placedAt: { [Op.gte]: sevenDaysAgo }
                    }
                },
                {
                    model: MenuItem,
                    as: 'menuItem',
                    attributes: ['name']
                }
            ],
            group: ['menu_item_id', 'menuItem.id', 'menuItem.name'],
            order: [[fn('SUM', col('quantity')), 'DESC']],
            limit: 5,
            raw: true,
            nest: true
        })
    ]);

    const revenueTodayCents = toSafeInteger(
        revenueTodayRow?.revenueTodayCents ?? 0
    );

    const averageOrderValueTodayCents = ordersTodayCount > 0 ? Math.round(revenueTodayCents / ordersTodayCount) : 0;

    const totals = {
        ordersToday: ordersTodayCount,
        completedOrdersToday: completedTodayCount,
        revenueTodayCents,
        averageOrderValueTodayCents,
        activeGuestSessions: activeSessionsCount
    };

    const orderStatusDistribution = statusRows.map((row) => ({
        status: row.status,
        count: Number(row.orderCount) || 0
    }));

    const trendLookup = new Map();
    for (const row of trendRows) {
        const key = row.bucketDate || row.date || row['DATE(placed_at)'];
        if (!key) {
            continue;
        }
        trendLookup.set(String(key), {
            date: String(key),
            revenueCents: toSafeInteger(row.revenueCents),
            orders: Number(row.orderCount) || 0
        });
    }

    const trendResult = [];
    for (let i = 0; i < 7; i += 1) {
        const current = new Date(sevenDaysAgo);
        current.setDate(sevenDaysAgo.getDate() + i);
        const key = buildDateKey(current);
        const entry = trendLookup.get(key);
        trendResult.push(
            entry || {
                date: key,
                revenueCents: 0,
                orders: 0
            }
        );
    }

    const topMenuItems = topItemsRows.map((row) => ({
        menuItemId: row.menuItemId,
        name: row.menuItem?.name || 'Unknown item',
        quantity: Number(row.totalQuantity) || 0,
        revenueCents: toSafeInteger(row.totalRevenueCents)
    }));

    return {
        totals,
        orderStatusDistribution,
        revenueTrend: trendResult,
        topMenuItems
    };
};

export default {
    getDashboardSummary
};



