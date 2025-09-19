import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import models from '../models/index.js';
import logger from '../../config/logger.js';
import {
    MEMBERSHIP_STATUS,
    ORDER_STATUS,
    KDS_TICKET_STATUS
} from '../utils/common.js';

const {
    sequelize,
    Restaurant,
    RestaurantTable,
    MenuCategory,
    MenuItem,
    GuestSession,
    Order,
    OrderItem,
    KdsTicket,
    RestaurantCustomer,
    Customer
} = models;

const resolveSession = async (sessionToken) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }

    const session = await GuestSession.findOne({
        where: { sessionToken },
        include: [
            { model: Restaurant, as: 'restaurant' },
            { model: RestaurantTable, as: 'table' },
            { model: Customer, as: 'customer', required: false }
        ]
    });

    if (!session || session.closedAt) {
        throw new Error('Session is not active');
    }

    return session;
};

const buildCustomerMeta = (customerPayload = {}) => ({
    firstName: customerPayload.firstName || null,
    lastName: customerPayload.lastName || null,
    email: customerPayload.email || null,
    phoneNumber: customerPayload.phoneNumber || null,
    membershipNumber: customerPayload.membershipNumber || null
});

const findExistingCustomer = async (lookup, transaction) => {
    const searchConditions = [];
    if (lookup.membershipNumber) {
        searchConditions.push({ membershipNumber: lookup.membershipNumber });
    }
    if (lookup.email) {
        searchConditions.push({ email: lookup.email });
    }
    if (lookup.phoneNumber) {
        searchConditions.push({ phoneNumber: lookup.phoneNumber });
    }

    if (searchConditions.length === 0) {
        return null;
    }

    return Customer.findOne({
        where: { [Op.or]: searchConditions },
        transaction,
        lock: transaction?.LOCK?.UPDATE
    });
};

const upsertCustomer = async (customerPayload, restaurantId, transaction) => {
    if (!customerPayload) {
        return { customer: null, membership: null, membershipStatus: MEMBERSHIP_STATUS.GUEST };
    }

    const now = new Date();
    const wantsMembership = Boolean(customerPayload.isMember || customerPayload.joinLoyalty || customerPayload.membershipNumber);

    let customer = await findExistingCustomer(customerPayload, transaction);

    if (!customer) {
        customer = await Customer.create(
            {
                firstName: customerPayload.firstName || null,
                lastName: customerPayload.lastName || null,
                email: customerPayload.email || null,
                phoneNumber: customerPayload.phoneNumber || null,
                membershipNumber: customerPayload.membershipNumber || null
            },
            { transaction }
        );
    } else {
        const updates = {};
        if (customerPayload.firstName && customer.firstName !== customerPayload.firstName) {
            updates.firstName = customerPayload.firstName;
        }
        if (customerPayload.lastName && customer.lastName !== customerPayload.lastName) {
            updates.lastName = customerPayload.lastName;
        }
        if (customerPayload.email && customer.email !== customerPayload.email) {
            updates.email = customerPayload.email;
        }
        if (customerPayload.phoneNumber && customer.phoneNumber !== customerPayload.phoneNumber) {
            updates.phoneNumber = customerPayload.phoneNumber;
        }
        if (customerPayload.membershipNumber && customer.membershipNumber !== customerPayload.membershipNumber) {
            updates.membershipNumber = customerPayload.membershipNumber;
        }

        if (Object.keys(updates).length > 0) {
            await customer.update(updates, { transaction });
        }
    }

    let membership = await RestaurantCustomer.findOne({
        where: {
            restaurantId,
            customerId: customer.id
        },
        transaction,
        lock: transaction?.LOCK?.UPDATE
    });

    if (!membership) {
        membership = await RestaurantCustomer.create(
            {
                restaurantId,
                customerId: customer.id,
                status: wantsMembership ? MEMBERSHIP_STATUS.MEMBER : MEMBERSHIP_STATUS.GUEST,
                joinedAt: now,
                lastVisitAt: now
            },
            { transaction }
        );
    } else {
        const nextStatus = wantsMembership ? MEMBERSHIP_STATUS.MEMBER : membership.status;
        await membership.update(
            {
                status: nextStatus,
                lastVisitAt: now
            },
            { transaction }
        );
    }

    return { customer, membership, membershipStatus: membership.status };
};

export const startSession = async ({ qrSlug, customer: customerPayload }) => {
    if (!qrSlug) {
        throw new Error('QR slug is required');
    }

    const table = await RestaurantTable.findOne({
        where: { qrSlug },
        include: [{ model: Restaurant, as: 'restaurant' }]
    });

    if (!table || !table.restaurant) {
        throw new Error('Restaurant table not found');
    }

    const sessionToken = uuid();

    return sequelize.transaction(async (transaction) => {
        const { customer, membership, membershipStatus } = await upsertCustomer(customerPayload, table.restaurantId, transaction);

        const guestSession = await GuestSession.create(
            {
                restaurantId: table.restaurantId,
                restaurantTableId: table.id,
                sessionToken,
                customerId: customer ? customer.id : null,
                membershipStatus,
                customerMeta: buildCustomerMeta(customerPayload)
            },
            { transaction }
        );

        return {
            sessionToken: guestSession.sessionToken,
            guestSessionId: guestSession.id,
            restaurant: {
                id: table.restaurant.id,
                name: table.restaurant.name
            },
            table: {
                id: table.id,
                name: table.name
            },
            membership: {
                status: membershipStatus,
                loyaltyPoints: membership ? membership.loyaltyPoints : 0,
                customerId: customer ? customer.id : null
            }
        };
    });
};

export const getMenuForSession = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    const categories = await MenuCategory.findAll({
        where: {
            restaurantId: session.restaurantId,
            isActive: true
        },
        include: [
            {
                model: MenuItem,
                as: 'items',
                where: { isAvailable: true },
                required: false
            }
        ],
        order: [
            ['sortOrder', 'ASC'],
            [{ model: MenuItem, as: 'items' }, 'name', 'ASC']
        ]
    });

    return {
        session: {
            id: session.id,
            token: session.sessionToken,
            tableName: session.table?.name || null,
            membershipStatus: session.membershipStatus
        },
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            sortOrder: category.sortOrder,
            items: (category.items || []).map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                priceCents: item.priceCents,
                price: item.priceCents / 100,
                sku: item.sku,
                prepTimeSeconds: item.prepTimeSeconds
            }))
        }))
    };
};

const computeOrderTotals = (items, menuItemMap) => {
    return items.reduce((acc, item) => {
        const menuItem = menuItemMap.get(item.menuItemId);
        const quantity = item.quantity || 1;
        if (!menuItem) {
            return acc;
        }
        return acc + menuItem.priceCents * quantity;
    }, 0);
};

const mapMenuItems = (menuItems) => {
    const itemMap = new Map();
    menuItems.forEach((menuItem) => {
        itemMap.set(menuItem.id, menuItem);
    });
    return itemMap;
};

export const placeOrderForSession = async (sessionToken, payload) => {
    const session = await resolveSession(sessionToken);
    const items = payload.items || [];

    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Order must contain at least one item');
    }

    const menuItemIds = items.map((item) => item.menuItemId);
    const uniqueMenuItemIds = Array.from(new Set(menuItemIds));

    return sequelize.transaction(async (transaction) => {
        const menuItems = await MenuItem.findAll({
            where: {
                id: uniqueMenuItemIds,
                isAvailable: true
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (menuItems.length !== uniqueMenuItemIds.length) {
            throw new Error('One or more menu items are unavailable');
        }

        const menuItemMap = mapMenuItems(menuItems);
        const totalCents = computeOrderTotals(items, menuItemMap);

        if (totalCents <= 0) {
            throw new Error('Order total must be greater than zero');
        }

        const order = await Order.create(
            {
                restaurantId: session.restaurantId,
                guestSessionId: session.id,
                customerId: session.customerId,
                status: ORDER_STATUS.PLACED,
                totalCents,
                specialRequest: payload.specialRequest || null
            },
            { transaction }
        );

        const orderItemsPayload = items.map((item) => {
            const menuItem = menuItemMap.get(item.menuItemId);
            return {
                orderId: order.id,
                menuItemId: menuItem.id,
                quantity: item.quantity || 1,
                priceCentsSnapshot: menuItem.priceCents,
                notes: item.notes || null
            };
        });

        await OrderItem.bulkCreate(orderItemsPayload, { transaction });

        const lastTicket = await KdsTicket.findOne({
            include: [
                {
                    model: Order,
                    as: 'order',
                    where: { restaurantId: session.restaurantId }
                }
            ],
            order: [['sequenceNo', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const nextSequenceNo = (lastTicket?.sequenceNo || 0) + 1;

        await KdsTicket.create(
            {
                orderId: order.id,
                sequenceNo: nextSequenceNo,
                status: KDS_TICKET_STATUS.QUEUED
            },
            { transaction }
        );

        if (session.customerId) {
            const membershipRecord = await RestaurantCustomer.findOne({
                where: {
                    restaurantId: session.restaurantId,
                    customerId: session.customerId
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (membershipRecord) {
                const earnedPoints = Math.floor(totalCents / 100);
                await membershipRecord.update(
                    {
                        loyaltyPoints: membershipRecord.loyaltyPoints + earnedPoints,
                        lastVisitAt: new Date()
                    },
                    { transaction }
                );
            }
        }

        logger.info('Customer order created', { orderId: order.id, sessionToken });

        return {
            orderId: order.id,
            status: order.status,
            totalCents: order.totalCents,
            total: order.totalCents / 100,
            items: orderItemsPayload.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                priceCents: item.priceCentsSnapshot,
                notes: item.notes || null
            }))
        };
    });
};

export const listOrdersForSession = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    const orders = await Order.findAll({
        where: { guestSessionId: session.id },
        include: [
            {
                model: OrderItem,
                as: 'items',
                include: [{ model: MenuItem, as: 'menuItem' }]
            },
            {
                model: KdsTicket,
                as: 'kdsTickets'
            }
        ],
        order: [['placedAt', 'DESC']]
    });

    return orders.map((order) => {
        const latestTicket = (order.kdsTickets || []).reduce((current, ticket) => {
            if (!current) {
                return ticket;
            }

            return ticket.sequenceNo > current.sequenceNo ? ticket : current;
        }, null);

        return {
            id: order.id,
            status: order.status,
            totalCents: order.totalCents,
            total: order.totalCents / 100,
            placedAt: order.placedAt,
            items: (order.items || []).map((item) => ({
                id: item.id,
                menuItemId: item.menuItemId,
                name: item.menuItem?.name || null,
                quantity: item.quantity,
                priceCents: item.priceCentsSnapshot,
                notes: item.notes || null
            })),
            ticket: latestTicket
                ? {
                      id: latestTicket.id,
                      status: latestTicket.status,
                      sequenceNo: latestTicket.sequenceNo
                  }
                : null
        };
    });
};
