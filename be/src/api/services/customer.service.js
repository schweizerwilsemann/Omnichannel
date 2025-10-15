import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import models from '../models/index.js';
import logger from '../../config/logger.js';
import env from '../../config/env.js';
import { sendEmail } from './email.service.js';
import { safeLoadOrderForEvent } from './order.service.js';
import { notifyOrderCreated } from './realtime.service.js';
import {
    MEMBERSHIP_STATUS,
    ORDER_STATUS,
    KDS_TICKET_STATUS,
    EMAIL_ACTIONS
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
    OrderItemRating,
    KdsTicket,
    RestaurantCustomer,
    Customer,
    CustomerVerificationToken
} = models;


const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_SALT_ROUNDS = 10;
const LOYALTY_POINT_VALUE_CENTS = 10;
const buildVerificationUrl = (verificationId, token) => {
    const base = (env.app.customerAppUrl || env.app.appUrl) || env.app.appUrl;
    const baseUrl = base.endsWith('/') ? base : `${base}/`;
    // Note: route is /customer/memberships/verify (plural) — keep consistent with customer.routes
    return `${baseUrl}customer/memberships/verify?verificationId=${verificationId}&token=${token}`;
};

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

export const getTableDetailsBySlug = async (qrSlug) => {
    if (!qrSlug) {
        throw new Error('QR slug is required');
    }

    const table = await RestaurantTable.findOne({
        where: { qrSlug },
        include: [{ model: Restaurant, as: 'restaurant' }]
    });

    if (!table || !table.restaurant) {
        return null;
    }

    const activeSession = await GuestSession.findOne({
        where: { restaurantTableId: table.id, closedAt: null },
        order: [['startedAt', 'DESC']]
    });

    return {
        qrSlug: table.qrSlug,
        restaurant: {
            id: table.restaurant.id,
            name: table.restaurant.name
        },
        table: {
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            status: table.status
        },
        activeSession: activeSession
            ? {
                  sessionToken: activeSession.sessionToken,
                  startedAt: activeSession.startedAt
              }
            : null
    };
};

export const getActiveSessionByToken = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    return {
        id: session.id,
        sessionToken: session.sessionToken,
        restaurantId: session.restaurantId,
        tableId: session.restaurantTableId,
        restaurant: session.restaurant
            ? {
                  id: session.restaurant.id,
                  name: session.restaurant.name
              }
            : null,
        table: session.table
            ? {
                  id: session.table.id,
                  name: session.table.name
              }
            : null
    };
};

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
            customer: customer
                ? {
                      id: customer.id,
                      firstName: customer.firstName,
                      lastName: customer.lastName,
                      email: customer.email,
                      phoneNumber: customer.phoneNumber
                  }
                : null,
            membership: {
                status: membershipStatus,
                loyaltyPoints: membership ? membership.loyaltyPoints : 0,
                discountBalanceCents: membership ? membership.discountBalanceCents : 0,
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

    let membership = null;
    if (session.customerId) {
        membership = await RestaurantCustomer.findOne({
            where: {
                restaurantId: session.restaurantId,
                customerId: session.customerId
            }
        });
    }

    return {
        session: {
            id: session.id,
            token: session.sessionToken,
            tableName: session.table?.name || null,
            membershipStatus: session.membershipStatus,
            membership: membership
                ? {
                      loyaltyPoints: membership.loyaltyPoints,
                      discountBalanceCents: membership.discountBalanceCents
                  }
                : null
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
                prepTimeSeconds: item.prepTimeSeconds,
                imageUrl: item.imageUrl
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
    const applyLoyaltyDiscount = Boolean(payload.applyLoyaltyDiscount);

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
        const subtotalCents = computeOrderTotals(items, menuItemMap);

        if (subtotalCents <= 0) {
            throw new Error('Order total must be greater than zero');
        }

        let membershipRecord = null;
        if (session.customerId) {
            membershipRecord = await RestaurantCustomer.findOne({
                where: {
                    restaurantId: session.restaurantId,
                    customerId: session.customerId
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
        }

        let discountAppliedCents = 0;
        if (membershipRecord && applyLoyaltyDiscount && membershipRecord.discountBalanceCents > 0) {
            discountAppliedCents = Math.min(membershipRecord.discountBalanceCents, subtotalCents);
        }

        const payableCents = Math.max(subtotalCents - discountAppliedCents, 0);
        const earnedLoyaltyPoints = membershipRecord ? Math.floor(payableCents / 100) : 0;

        const order = await Order.create(
            {
                restaurantId: session.restaurantId,
                guestSessionId: session.id,
                customerId: session.customerId,
                status: ORDER_STATUS.PLACED,
                totalCents: payableCents,
                discountAppliedCents,
                earnedLoyaltyPoints,
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

        let membershipSummary = null;
        if (membershipRecord) {
            const nextDiscountBalance = Math.max(membershipRecord.discountBalanceCents - discountAppliedCents, 0);
            await membershipRecord.update(
                {
                    loyaltyPoints: membershipRecord.loyaltyPoints + earnedLoyaltyPoints,
                    discountBalanceCents: nextDiscountBalance,
                    lastVisitAt: new Date()
                },
                { transaction }
            );
            membershipSummary = {
                loyaltyPoints: membershipRecord.loyaltyPoints,
                discountBalanceCents: membershipRecord.discountBalanceCents
            };
        }

        logger.info('Customer order created', { orderId: order.id, sessionToken });

        transaction.afterCommit(() => {
            (async () => {
                const adminOrder = await safeLoadOrderForEvent(order.id);
                if (adminOrder) {
                    notifyOrderCreated(adminOrder);
                }
            })().catch((error) => {
                logger.warn('Failed to dispatch order.created event', { message: error.message, orderId: order.id });
            });
        });

        return {
            orderId: order.id,
            status: order.status,
            subtotalCents,
            discountAppliedCents,
            totalCents: order.totalCents,
            total: order.totalCents / 100,
            earnedLoyaltyPoints,
            membership: membershipSummary,
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
                include: [
                    { model: MenuItem, as: 'menuItem' },
                    { model: OrderItemRating, as: 'rating' }
                ]
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

        const items = (order.items || []).map((item) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            name: item.menuItem?.name || null,
            quantity: item.quantity,
            priceCents: item.priceCentsSnapshot,
            notes: item.notes || null,
            rating: item.rating
                ? {
                      value: item.rating.rating,
                      comment: item.rating.comment,
                      ratedAt: item.rating.ratedAt
                  }
                : null
        }));

        const unratedItems = items.filter((item) => !item.rating);

        return {
            id: order.id,
            status: order.status,
            totalCents: order.totalCents,
            total: order.totalCents / 100,
            discountAppliedCents: order.discountAppliedCents || 0,
            earnedLoyaltyPoints: order.earnedLoyaltyPoints || 0,
            placedAt: order.placedAt,
            canRate: order.status === ORDER_STATUS.COMPLETED && unratedItems.length > 0,
            items,
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









export const claimLoyaltyPoints = async (sessionToken, points) => {
    const session = await resolveSession(sessionToken);

    if (!session.customerId) {
        throw new Error('You need a loyalty membership to claim points');
    }

    const normalizedPoints = Number(points);
    if (!Number.isInteger(normalizedPoints) || normalizedPoints <= 0) {
        throw new Error('Points to claim must be a positive integer');
    }

    return sequelize.transaction(async (transaction) => {
        const membershipRecord = await RestaurantCustomer.findOne({
            where: {
                restaurantId: session.restaurantId,
                customerId: session.customerId
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!membershipRecord) {
            throw new Error('Membership record not found for this session');
        }

        if (membershipRecord.loyaltyPoints < normalizedPoints) {
            throw new Error('Not enough loyalty points to claim the requested amount');
        }

        const discountValueCents = normalizedPoints * LOYALTY_POINT_VALUE_CENTS;

        await membershipRecord.update(
            {
                loyaltyPoints: membershipRecord.loyaltyPoints - normalizedPoints,
                discountBalanceCents: membershipRecord.discountBalanceCents + discountValueCents,
                lastClaimedAt: new Date()
            },
            { transaction }
        );

        await membershipRecord.reload({ transaction });

        return {
            claimedPoints: normalizedPoints,
            discountValueCents,
            pointValueCents: LOYALTY_POINT_VALUE_CENTS,
            loyaltyPoints: membershipRecord.loyaltyPoints,
            discountBalanceCents: membershipRecord.discountBalanceCents,
            lastClaimedAt: membershipRecord.lastClaimedAt
        };
    });
};

export const submitOrderRatings = async (sessionToken, orderId, ratings = []) => {
    const session = await resolveSession(sessionToken);

    if (!Array.isArray(ratings) || ratings.length === 0) {
        throw new Error('At least one rating entry is required');
    }

    return sequelize.transaction(async (transaction) => {
        const order = await Order.findOne({
            where: { id: orderId, guestSessionId: session.id },
            include: [{ model: OrderItem, as: 'items' }],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!order) {
            throw new Error('Order not found for this session');
        }

        if (order.status !== ORDER_STATUS.COMPLETED) {
            throw new Error('Order must be completed before it can be rated');
        }

        const itemMap = new Map((order.items || []).map((item) => [item.id, item]));
        const normalizedRatings = ratings.map((entry) => {
            if (!entry.orderItemId || !itemMap.has(entry.orderItemId)) {
                throw new Error('One or more rated dishes were not found in this order');
            }

            const ratingValue = Number(entry.rating);
            if (!Number.isFinite(ratingValue)) {
                throw new Error('Rating must be a number');
            }

            const clampedRating = Math.max(1, Math.min(5, Math.round(ratingValue)));

            return {
                orderItemId: entry.orderItemId,
                rating: clampedRating,
                comment: entry.comment ? String(entry.comment).slice(0, 500) : null
            };
        });

        const results = [];
        for (const entry of normalizedRatings) {
            const orderItem = itemMap.get(entry.orderItemId);
            await OrderItemRating.upsert(
                {
                    orderId: order.id,
                    orderItemId: orderItem.id,
                    menuItemId: orderItem.menuItemId,
                    restaurantId: order.restaurantId,
                    guestSessionId: order.guestSessionId,
                    customerId: session.customerId || null,
                    rating: entry.rating,
                    comment: entry.comment,
                    ratedAt: new Date()
                },
                { transaction }
            );
            results.push({
                orderItemId: orderItem.id,
                rating: entry.rating,
                comment: entry.comment
            });
        }

        return {
            orderId: order.id,
            ratings: results
        };
    });
};
export const requestMembershipVerification = async ({ sessionToken, customer: customerPayload = {} }) => {
    const session = await resolveSession(sessionToken);

    const normalizedPayload = {
        firstName: customerPayload.firstName ?? session.customer?.firstName ?? null,
        lastName: customerPayload.lastName ?? session.customer?.lastName ?? null,
        email: customerPayload.email ?? session.customer?.email ?? null,
        phoneNumber: customerPayload.phoneNumber ?? session.customer?.phoneNumber ?? null,
        membershipNumber: customerPayload.membershipNumber ?? session.customer?.membershipNumber ?? null
    };

    if (!normalizedPayload.email) {
        throw new Error('Email is required to request membership verification');
    }

    return sequelize.transaction(async (transaction) => {
        const { customer, membership } = await upsertCustomer(normalizedPayload, session.restaurantId, transaction);

        // If the customer is already a member, there's no need to create a verification token or send an email.
        if (membership && membership.status === MEMBERSHIP_STATUS.MEMBER) {
            return {
                customerId: customer.id,
                restaurantId: session.restaurantId,
                membershipStatus: MEMBERSHIP_STATUS.MEMBER,
                email: normalizedPayload.email,
                expiresAt: null
            };
        }

        const sessionForUpdate = await GuestSession.findByPk(session.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (sessionForUpdate) {
            await sessionForUpdate.update(
                {
                    customerId: customer.id,
                    membershipStatus: membership.status,
                    customerMeta: buildCustomerMeta(normalizedPayload)
                },
                { transaction }
            );
        }

        await CustomerVerificationToken.update(
            { usedAt: new Date() },
            {
                where: {
                    customerId: customer.id,
                    restaurantId: session.restaurantId,
                    usedAt: null
                },
                transaction
            }
        );

        const rawToken = uuid();
        const tokenHash = await bcrypt.hash(rawToken, TOKEN_SALT_ROUNDS);
        const verification = await CustomerVerificationToken.create(
            {
                customerId: customer.id,
                restaurantId: session.restaurantId,
                email: normalizedPayload.email,
                tokenHash,
                expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS)
            },
            { transaction }
        );

        const restaurantName = session.restaurant?.name || 'our restaurant';
        const verifyUrl = buildVerificationUrl(verification.id, rawToken);

        transaction.afterCommit(() => {
            sendEmail(
                {
                    firstName: normalizedPayload.firstName || customer.firstName,
                    lastName: normalizedPayload.lastName || customer.lastName,
                    restaurantName,
                    verifyUrl
                },
                normalizedPayload.email,
                EMAIL_ACTIONS.CUSTOMER_VERIFY_MEMBERSHIP
            ).catch((error) => {
                logger.warn('Failed to send membership verification email', {
                    message: error.message,
                    customerId: customer.id,
                    restaurantId: session.restaurantId
                });
            });
        });

        return {
            customerId: customer.id,
            restaurantId: session.restaurantId,
            membershipStatus: membership.status,
            email: normalizedPayload.email,
            expiresAt: verification.expiresAt
        };
    });
};

export const verifyMembershipToken = async ({ verificationId, token }) => {
    return sequelize.transaction(async (transaction) => {
        const record = await CustomerVerificationToken.findOne({
            where: { id: verificationId },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!record) {
            throw new Error('Verification request not found');
        }

        if (record.usedAt) {
            const membership = await RestaurantCustomer.findOne({
                where: {
                    restaurantId: record.restaurantId,
                    customerId: record.customerId
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const activeGuestSession = await GuestSession.findOne({
                where: {
                    customerId: record.customerId,
                    restaurantId: record.restaurantId,
                    closedAt: null
                }
            });

            return {
                customerId: record.customerId,
                restaurantId: record.restaurantId,
                membershipStatus: membership?.status || MEMBERSHIP_STATUS.MEMBER,
                sessionToken: activeGuestSession?.sessionToken || null,
                alreadyVerified: true
            };
        }

        if (record.expiresAt < new Date()) {
            throw new Error('Verification link has expired');
        }

        const tokenValid = await bcrypt.compare(token, record.tokenHash);
        if (!tokenValid) {
            throw new Error('Invalid verification token');
        }

        let membership = await RestaurantCustomer.findOne({
            where: {
                restaurantId: record.restaurantId,
                customerId: record.customerId
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!membership) {
            membership = await RestaurantCustomer.create(
                {
                    restaurantId: record.restaurantId,
                    customerId: record.customerId,
                    status: MEMBERSHIP_STATUS.MEMBER,
                    joinedAt: new Date()
                },
                { transaction }
            );
        } else if (membership.status !== MEMBERSHIP_STATUS.MEMBER) {
            await membership.update(
                {
                    status: MEMBERSHIP_STATUS.MEMBER,
                    joinedAt: membership.joinedAt || new Date()
                },
                { transaction }
            );
        }

        await record.update(
            {
                usedAt: new Date()
            },
            { transaction }
        );

        await GuestSession.update(
            { membershipStatus: MEMBERSHIP_STATUS.MEMBER },
            {
                where: {
                    customerId: record.customerId,
                    restaurantId: record.restaurantId,
                    closedAt: null
                },
                transaction
            }
        );

        const activeGuestSession = await GuestSession.findOne({
            where: {
                customerId: record.customerId,
                restaurantId: record.restaurantId,
                closedAt: null
            }
        });

        return {
            customerId: record.customerId,
            restaurantId: record.restaurantId,
            membershipStatus: MEMBERSHIP_STATUS.MEMBER,
            sessionToken: activeGuestSession?.sessionToken || null,
            alreadyVerified: false
        };
    });
};

export const getMembershipStatus = async (customerId, restaurantId) => {
    if (!customerId || !restaurantId) {
        throw new Error('customerId and restaurantId are required');
    }

    const membership = await RestaurantCustomer.findOne({
        where: { customerId, restaurantId }
    });

    if (!membership) {
        return { status: MEMBERSHIP_STATUS.GUEST };
    }

    return {
        status: membership.status,
        loyaltyPoints: membership.loyaltyPoints,
        discountBalanceCents: membership.discountBalanceCents,
        joinedAt: membership.joinedAt
    };
};

export const closeSessionByToken = async (sessionToken) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }

    const session = await GuestSession.findOne({ where: { sessionToken } });
    if (!session) {
        throw new Error('Session not found');
    }

    if (session.closedAt) {
        return { message: 'Session already closed' };
    }

    await session.update({ closedAt: new Date() });

    return { message: 'Session closed' };
};

