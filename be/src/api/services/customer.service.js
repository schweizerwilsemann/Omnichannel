import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import models from '../models/index.js';
import logger from '../../config/logger.js';
import env from '../../config/env.js';
import { sendEmail } from './email.service.js';
import { safeLoadOrderForEvent } from './order.service.js';
import { notifyOrderCreated } from './realtime.service.js';
import { normalizeAssetUrl } from './storage.service.js';
import { verifyPromotionClaimToken } from '../utils/promotionTokens.js';
import {
    MEMBERSHIP_STATUS,
    ORDER_STATUS,
    KDS_TICKET_STATUS,
    EMAIL_ACTIONS,
    AUTH_CHALLENGE_TYPES,
    PROMOTION_STATUS,
    VOUCHER_STATUS,
    CUSTOMER_VOUCHER_STATUS,
    DISCOUNT_TYPES
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
    CustomerVerificationToken,
    Promotion,
    Voucher,
    VoucherTier,
    CustomerVoucher,
    CustomerAuthChallenge
} = models;


const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_SALT_ROUNDS = 10;
const LOYALTY_POINT_VALUE_CENTS = 10;
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;
const TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const AUTHENTICATOR_WINDOW = 1;

const buildVerificationUrl = (verificationId, token) => {
    const base = (env.app.customerAppUrl || env.app.appUrl) || env.app.appUrl;
    const baseUrl = base.endsWith('/') ? base : `${base}/`;
    // Note: route is /customer/memberships/verify (plural) — keep consistent with customer.routes
    return `${baseUrl}customer/memberships/verify?verificationId=${verificationId}&token=${token}`;
};

const normalizeCode = (code) => String(code || '').trim();
const normalizePin = (pin) => String(pin || '').trim();
const isValidPinFormat = (pin) => /^[0-9]+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;

const hashPin = async (pin) => bcrypt.hash(pin, TOKEN_SALT_ROUNDS);

const verifyPin = async (pin, hash) => bcrypt.compare(pin, hash || '');

const buildAuthenticatorKeyUri = (customer, restaurantName, secretOverride) => {
    const secret = secretOverride || customer.authenticatorSecret || null;
    if (!secret) {
        return null;
    }
    const label = customer.email || `${customer.firstName || 'guest'}@${restaurantName || 'omnichannel'}`;
    const issuer = restaurantName || 'Omnichannel';
    return authenticator.keyuri(label, issuer, secret);
};

authenticator.options = {
    ...authenticator.options,
    window: AUTHENTICATOR_WINDOW
};

const recordChallengeAttempt = async (challenge, { success }) => {
    const metadata = { ...(challenge.metadata || {}) };
    const updates = { metadata };

    if (success) {
        updates.consumedAt = new Date();
    } else {
        const nextAttempts = (challenge.attempts || 0) + 1;
        updates.attempts = nextAttempts;
        if (nextAttempts >= MAX_CHALLENGE_ATTEMPTS) {
            updates.consumedAt = new Date();
        }
    }

    await challenge.update(updates);
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

const MAX_DISCOUNT_RATIO = 0.5;

const toPlain = (instance) => {
    if (!instance) {
        return null;
    }

    if (typeof instance.get === 'function') {
        return instance.get({ plain: true });
    }

    if (typeof instance.toJSON === 'function') {
        return instance.toJSON();
    }

    if (typeof instance === 'object') {
        return { ...instance };
    }

    return null;
};

const normalizeDate = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isWithinSchedule = (startsAt, endsAt, referenceDate = new Date()) => {
    const reference = normalizeDate(referenceDate);
    if (!reference) {
        return false;
    }

    const start = normalizeDate(startsAt);
    const end = normalizeDate(endsAt);

    if (start && reference < start) {
        return false;
    }

    if (end && reference > end) {
        return false;
    }

    return true;
};

const sortVoucherTiers = (tiers = []) =>
    [...tiers].sort((a, b) => {
        if (a.minSpendCents !== b.minSpendCents) {
            return a.minSpendCents - b.minSpendCents;
        }
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

const formatVoucherTier = (tierPlain) => ({
    id: tierPlain.id,
    minSpendCents: tierPlain.minSpendCents,
    discountPercent: Number.parseFloat(tierPlain.discountPercent) || 0,
    maxDiscountCents: tierPlain.maxDiscountCents,
    sortOrder: tierPlain.sortOrder
});

const buildCustomerVoucherPayload = (recordInstance) => {
    const record = toPlain(recordInstance);
    if (!record) {
        return null;
    }

    const voucher = record.voucher ? toPlain(record.voucher) : null;
    const promotion = record.promotion ? toPlain(record.promotion) : null;

    return {
        id: record.id,
        voucherId: record.voucherId,
        promotionId: record.promotionId,
        restaurantId: record.restaurantId,
        customerId: record.customerId,
        code: record.code,
        status: record.status,
        claimChannel: record.claimChannel,
        claimedAt: record.claimedAt,
        expiresAt: record.expiresAt,
        redeemedAt: record.redeemedAt,
        metadata: record.metadata || null,
        voucher: voucher
            ? {
                  id: voucher.id,
                  code: voucher.code,
                  name: voucher.name,
                  description: voucher.description,
                  status: voucher.status,
                  discountType: voucher.discountType,
                  allowStackWithPoints: voucher.allowStackWithPoints,
                  claimsPerCustomer: voucher.claimsPerCustomer,
                  totalClaimLimit: voucher.totalClaimLimit,
                  validFrom: voucher.validFrom,
                  validUntil: voucher.validUntil,
                  termsUrl: voucher.termsUrl,
                  tiers: sortVoucherTiers(voucher.tiers || []).map((tier) => formatVoucherTier(tier))
              }
            : null,
        promotion: promotion
            ? {
                  id: promotion.id,
                  name: promotion.name,
                  headline: promotion.headline,
                  description: promotion.description,
                  bannerImageUrl: normalizeAssetUrl(promotion.bannerImageUrl),
                  ctaLabel: promotion.ctaLabel,
                  ctaUrl: promotion.ctaUrl,
                  status: promotion.status,
                  startsAt: promotion.startsAt,
                  endsAt: promotion.endsAt
              }
            : null
    };
};

const buildPromotionPayload = (promotionInstance, claimsByVoucherId, referenceDate = new Date(), hasCustomer = false) => {
    const promotion = toPlain(promotionInstance);
    if (!promotion) {
        return null;
    }

    const vouchers = (promotion.vouchers || []).map((voucherPlain) => {
        const tiers = sortVoucherTiers(voucherPlain.tiers || []).map((tier) => formatVoucherTier(tier));
        const claim = claimsByVoucherId.get(voucherPlain.id) || null;

        const validNow = voucherPlain.status === VOUCHER_STATUS.ACTIVE && isWithinSchedule(voucherPlain.validFrom, voucherPlain.validUntil, referenceDate);
        const customerVoucher = claim ? buildCustomerVoucherPayload(claim) : null;
        const alreadyClaimed = Boolean(customerVoucher && customerVoucher.status !== CUSTOMER_VOUCHER_STATUS.REVOKED);

        return {
            id: voucherPlain.id,
            code: voucherPlain.code,
            name: voucherPlain.name,
            description: voucherPlain.description,
            status: voucherPlain.status,
            discountType: voucherPlain.discountType,
            allowStackWithPoints: voucherPlain.allowStackWithPoints,
            claimsPerCustomer: voucherPlain.claimsPerCustomer,
            totalClaimLimit: voucherPlain.totalClaimLimit,
            validFrom: voucherPlain.validFrom,
            validUntil: voucherPlain.validUntil,
            termsUrl: voucherPlain.termsUrl,
            tiers,
            customerVoucher,
            alreadyClaimed,
            claimable: hasCustomer && !alreadyClaimed && validNow
        };
    });

    return {
        id: promotion.id,
        restaurantId: promotion.restaurantId,
        name: promotion.name,
        headline: promotion.headline,
        description: promotion.description,
        bannerImageUrl: normalizeAssetUrl(promotion.bannerImageUrl),
        ctaLabel: promotion.ctaLabel,
        ctaUrl: promotion.ctaUrl,
        status: promotion.status,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        emailSubject: promotion.emailSubject,
        emailPreviewText: promotion.emailPreviewText,
        emailBody: promotion.emailBody,
        vouchers: vouchers.filter(Boolean)
    };
};

const selectVoucherTierForSubtotal = (voucherPlain, subtotalCents) => {
    if (!voucherPlain) {
        return null;
    }
    const tiers = sortVoucherTiers(voucherPlain.tiers || []);
    if (tiers.length === 0) {
        return null;
    }

    let selected = null;
    for (const tier of tiers) {
        if (subtotalCents >= tier.minSpendCents) {
            selected = tier;
        } else {
            break;
        }
    }

    return selected;
};

const computeVoucherDiscountForSubtotal = (voucherPlain, subtotalCents) => {
    if (!voucherPlain) {
        return { discountCents: 0, tier: null };
    }

    if (voucherPlain.discountType !== DISCOUNT_TYPES.PERCENTAGE) {
        return { discountCents: 0, tier: null };
    }

    const selectedTier = selectVoucherTierForSubtotal(voucherPlain, subtotalCents);
    if (!selectedTier) {
        return { discountCents: 0, tier: null };
    }

    const percent = Number.parseFloat(selectedTier.discountPercent) || 0;
    if (percent <= 0) {
        return { discountCents: 0, tier: selectedTier };
    }

    let discountCents = Math.floor((percent / 100) * subtotalCents);
    if (selectedTier.maxDiscountCents && selectedTier.maxDiscountCents > 0) {
        discountCents = Math.min(discountCents, selectedTier.maxDiscountCents);
    }

    return {
        discountCents,
        tier: selectedTier,
        percent
    };
};

const computeLegalDiscountCap = (subtotalCents) => Math.floor(subtotalCents * MAX_DISCOUNT_RATIO);

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

export const listActivePromotions = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    const referenceDate = new Date();
    const promotions = await Promotion.findAll({
        where: {
            restaurantId: session.restaurantId,
            status: PROMOTION_STATUS.ACTIVE,
            [Op.and]: [
                { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: referenceDate } }] },
                { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: referenceDate } }] }
            ]
        },
        include: [
            {
                model: Voucher,
                as: 'vouchers',
                required: false,
                where: {
                    status: VOUCHER_STATUS.ACTIVE
                },
                include: [{ model: VoucherTier, as: 'tiers', required: false }]
            }
        ],
        order: [
            ['startsAt', 'ASC'],
            ['createdAt', 'DESC'],
            [{ model: Voucher, as: 'vouchers' }, 'createdAt', 'ASC'],
            [{ model: Voucher, as: 'vouchers' }, { model: VoucherTier, as: 'tiers' }, 'minSpendCents', 'ASC']
        ]
    });

    if (promotions.length === 0) {
        return [];
    }

    let claimsByVoucherId = new Map();
    if (session.customerId) {
        const voucherIds = promotions.flatMap((promotion) => (promotion.vouchers || []).map((voucher) => voucher.id));
        if (voucherIds.length > 0) {
            const customerClaims = await CustomerVoucher.findAll({
                where: {
                    customerId: session.customerId,
                    voucherId: { [Op.in]: voucherIds }
                }
            });
            claimsByVoucherId = new Map(customerClaims.map((claim) => [claim.voucherId, claim]));
        }
    }

    return promotions
        .map((promotion) => buildPromotionPayload(promotion, claimsByVoucherId, referenceDate, Boolean(session.customerId)))
        .filter(Boolean);
};

export const listCustomerVouchers = async (sessionToken) => {
    const session = await resolveSession(sessionToken);
    if (!session.customerId) {
        return {
            available: [],
            redeemed: [],
            expired: [],
            revoked: []
        };
    }

    return sequelize.transaction(async (transaction) => {
        const records = await CustomerVoucher.findAll({
            where: {
                restaurantId: session.restaurantId,
                customerId: session.customerId
            },
            include: [
                {
                    model: Voucher,
                    as: 'voucher',
                    include: [{ model: VoucherTier, as: 'tiers', required: false }]
                },
                { model: Promotion, as: 'promotion', required: false }
            ],
            order: [['claimedAt', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const referenceDate = new Date();
        const formatted = [];

        for (const record of records) {
            const expiresAt = normalizeDate(record.expiresAt);
            if (
                record.status === CUSTOMER_VOUCHER_STATUS.AVAILABLE &&
                expiresAt &&
                expiresAt < referenceDate
            ) {
                await record.update(
                    { status: CUSTOMER_VOUCHER_STATUS.EXPIRED },
                    { transaction }
                );
                record.status = CUSTOMER_VOUCHER_STATUS.EXPIRED;
            }
            formatted.push(buildCustomerVoucherPayload(record));
        }

        return {
            available: formatted.filter((entry) => entry && entry.status === CUSTOMER_VOUCHER_STATUS.AVAILABLE),
            redeemed: formatted.filter((entry) => entry && entry.status === CUSTOMER_VOUCHER_STATUS.REDEEMED),
            expired: formatted.filter((entry) => entry && entry.status === CUSTOMER_VOUCHER_STATUS.EXPIRED),
            revoked: formatted.filter((entry) => entry && entry.status === CUSTOMER_VOUCHER_STATUS.REVOKED)
        };
    });
};

const claimVoucherForCustomer = async ({ restaurantId, customerId }, payload = {}, { channel = 'CUSTOMER_APP', tokenPayload } = {}) => {
    if (!restaurantId) {
        throw new Error('Restaurant context is required to claim vouchers');
    }

    if (!customerId) {
        throw new Error('You need a loyalty membership to claim vouchers');
    }

    const { promotionId, voucherId } = payload;
    const now = new Date();

    return sequelize.transaction(async (transaction) => {
        let voucher = null;
        if (voucherId) {
            voucher = await Voucher.findOne({
                where: {
                    id: voucherId,
                    restaurantId
                },
                include: [
                    { model: VoucherTier, as: 'tiers', required: false },
                    { model: Promotion, as: 'promotion', required: false }
                ],
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!voucher) {
                throw new Error('Voucher not found for this restaurant');
            }
        } else if (promotionId) {
            const promotion = await Promotion.findOne({
                where: {
                    id: promotionId,
                    restaurantId,
                    status: PROMOTION_STATUS.ACTIVE,
                    [Op.and]: [
                        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
                        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
                    ]
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!promotion) {
                throw new Error('Promotion is no longer active');
            }

            voucher = await Voucher.findOne({
                where: {
                    promotionId: promotion.id,
                    restaurantId,
                    status: VOUCHER_STATUS.ACTIVE
                },
                include: [
                    { model: VoucherTier, as: 'tiers', required: false },
                    { model: Promotion, as: 'promotion', required: false }
                ],
                order: [['createdAt', 'ASC']],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!voucher) {
                throw new Error('This promotion does not have an active voucher to claim right now');
            }
        } else {
            throw new Error('Voucher or promotion reference is required');
        }

        if (voucher.status !== VOUCHER_STATUS.ACTIVE) {
            throw new Error('Voucher is not active');
        }

        if (!isWithinSchedule(voucher.validFrom, voucher.validUntil, now)) {
            throw new Error('Voucher is not available at this time');
        }

        const existingClaim = await CustomerVoucher.findOne({
            where: {
                voucherId: voucher.id,
                customerId
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (existingClaim) {
            if (existingClaim.status === CUSTOMER_VOUCHER_STATUS.EXPIRED) {
                throw new Error('This voucher has already expired for your account');
            }
            if (existingClaim.status === CUSTOMER_VOUCHER_STATUS.REDEEMED) {
                throw new Error('You already used this voucher on a previous order');
            }
            if (existingClaim.status === CUSTOMER_VOUCHER_STATUS.REVOKED) {
                throw new Error('This voucher is no longer available for your account');
            }
            const existingPayload = buildCustomerVoucherPayload(existingClaim);
            return { ...existingPayload, alreadyClaimed: true };
        }

        if (voucher.totalClaimLimit) {
            const claimedCount = await CustomerVoucher.count({
                where: { voucherId: voucher.id },
                transaction
            });
            if (claimedCount >= voucher.totalClaimLimit) {
                throw new Error('This voucher has reached its claim limit');
            }
        }

        const expiresAt = normalizeDate(voucher.validUntil) || normalizeDate(voucher.promotion?.endsAt) || null;
        const metadata = {
            claimedVia: channel,
            tokenPromotionId: tokenPayload?.promotionId || undefined,
            tokenVoucherId: tokenPayload?.voucherId || undefined,
            tokenEmail: tokenPayload?.email || undefined
        };
        Object.keys(metadata).forEach((key) => {
            if (metadata[key] === undefined || metadata[key] === null) {
                delete metadata[key];
            }
        });

        const record = await CustomerVoucher.create(
            {
                voucherId: voucher.id,
                promotionId: voucher.promotionId,
                restaurantId,
                customerId,
                code: voucher.code,
                status: CUSTOMER_VOUCHER_STATUS.AVAILABLE,
                claimChannel: channel,
                expiresAt,
                metadata
            },
            { transaction }
        );

        const membershipRecord = await RestaurantCustomer.findOne({
            where: {
                restaurantId,
                customerId
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (membershipRecord) {
            await membershipRecord.update({ lastClaimedAt: new Date() }, { transaction });
        }

        const fullRecord = await CustomerVoucher.findByPk(record.id, {
            include: [
                {
                    model: Voucher,
                    as: 'voucher',
                    include: [{ model: VoucherTier, as: 'tiers', required: false }]
                },
                { model: Promotion, as: 'promotion', required: false }
            ],
            transaction
        });

        const payload = buildCustomerVoucherPayload(fullRecord);
        return { ...payload, alreadyClaimed: false };
    });
};

export const claimPromotionVoucher = async (sessionToken, payload = {}) => {
    const session = await resolveSession(sessionToken);
    const channel = payload.channel || 'CUSTOMER_APP';
    const claimPayload = {
        promotionId: payload.promotionId || undefined,
        voucherId: payload.voucherId || undefined
    };

    return claimVoucherForCustomer(
        { restaurantId: session.restaurantId, customerId: session.customerId },
        claimPayload,
        { channel }
    );
};

export const claimPromotionVoucherByToken = async (token, payload = {}) => {
    const tokenData = verifyPromotionClaimToken(token);
    const restaurantId = tokenData.restaurantId;
    const customerId = tokenData.customerId;

    if (!restaurantId || !customerId) {
        throw new Error('Invalid claim token');
    }

    const membership = await RestaurantCustomer.findOne({
        where: {
            id: tokenData.membershipId,
            restaurantId,
            customerId
        },
        include: [{ model: Customer, as: 'customer', required: true }]
    });

    if (!membership) {
        throw new Error('Membership not found for this claim token');
    }

    if (membership.status !== MEMBERSHIP_STATUS.MEMBER) {
        throw new Error('Your membership is not active');
    }

    if (
        tokenData.email &&
        membership.customer.email &&
        membership.customer.email.toLowerCase() !== tokenData.email.toLowerCase()
    ) {
        throw new Error('This claim link does not match your membership email');
    }

    const claimPayload = {
        promotionId: payload.promotionId || tokenData.promotionId || undefined,
        voucherId: payload.voucherId || tokenData.voucherId || undefined
    };

    if (!claimPayload.promotionId && !claimPayload.voucherId) {
        throw new Error('Promotion reference missing from claim token');
    }

    return claimVoucherForCustomer(
        { restaurantId, customerId },
        claimPayload,
        { channel: 'EMAIL', tokenPayload: tokenData }
    );
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

export const requestLoginChallenge = async ({ qrSlug, email, pin, method }) => {
    if (!qrSlug) {
        throw new Error('QR slug is required');
    }

    const targetEmail = String(email || '').trim();
    if (!targetEmail) {
        throw new Error('Email is required');
    }

    let normalizedMethod = typeof method === 'string' ? method.trim().toUpperCase() : 'PIN';
    if (normalizedMethod !== 'AUTHENTICATOR') {
        normalizedMethod = 'PIN';
    }

    const table = await RestaurantTable.findOne({
        where: { qrSlug },
        include: [{ model: Restaurant, as: 'restaurant' }]
    });

    if (!table || !table.restaurant) {
        throw new Error('Restaurant table not found');
    }

    const customer = await Customer.findOne({
        where: { email: targetEmail }
    });

    if (!customer) {
        throw new Error('We could not find an account with that email.');
    }

    const membership = await RestaurantCustomer.findOne({
        where: {
            restaurantId: table.restaurantId,
            customerId: customer.id
        }
    });

    if (!membership || membership.status !== MEMBERSHIP_STATUS.MEMBER) {
        throw new Error('This email is not registered as a member for this restaurant.');
    }

    if (normalizedMethod === 'PIN') {
        const normalizedPin = normalizePin(pin);
        if (!isValidPinFormat(normalizedPin)) {
            throw new Error('PIN must be a 4–6 digit number.');
        }
        if (!membership.pinHash) {
            throw new Error('This membership does not have a PIN yet.');
        }
        const pinMatches = await verifyPin(normalizedPin, membership.pinHash);
        if (!pinMatches) {
            throw new Error('Incorrect email or PIN.');
        }
    } else {
        if (!customer.authenticatorEnabled || !customer.authenticatorSecret) {
            throw new Error('Authenticator app is not enabled for this account.');
        }
    }

    if (normalizedMethod === 'AUTHENTICATOR') {
        if (!customer.authenticatorEnabled || !customer.authenticatorSecret) {
            throw new Error('Authenticator app is not enabled for this account.');
        }

        await CustomerAuthChallenge.update(
            { consumedAt: new Date() },
            {
                where: {
                    customerId: customer.id,
                    restaurantId: table.restaurantId,
                    consumedAt: null
                }
            }
        );

        const challenge = await CustomerAuthChallenge.create({
            customerId: customer.id,
            restaurantId: table.restaurantId,
            challengeType: AUTH_CHALLENGE_TYPES.TOTP,
            expiresAt: new Date(Date.now() + TOTP_CHALLENGE_TTL_MS),
            metadata: {
                qrSlug
            }
        });

        return {
            requiresTotp: true,
            challengeId: challenge.id,
            expiresAt: challenge.expiresAt
        };
    }

    const sessionDetails = await startSession({
        qrSlug,
        customer: {
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phoneNumber: customer.phoneNumber,
            membershipNumber: customer.membershipNumber,
            isMember: true
        }
    });

    return {
        requiresTotp: false,
        authenticatedWith: 'PIN',
        qrSlug,
        ...sessionDetails
    };
};

export const verifyLoginChallenge = async ({ qrSlug, challengeId, code }) => {
    if (!qrSlug) {
        throw new Error('QR slug is required');
    }
    if (!challengeId) {
        throw new Error('Challenge identifier is required');
    }

    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
        throw new Error('Authentication code is required');
    }

    const challenge = await CustomerAuthChallenge.findByPk(challengeId);
    if (!challenge) {
        throw new Error('Authentication request not found');
    }

    if (challenge.consumedAt) {
        throw new Error('Authentication request has already been used');
    }

    const challengeType = challenge.challengeType || challenge.challenge_type || challenge.method || null;

    if (challengeType !== AUTH_CHALLENGE_TYPES.TOTP) {
        throw new Error('Unsupported authentication challenge');
    }

    if (challenge.expiresAt < new Date()) {
        await recordChallengeAttempt(challenge, { success: false });
        throw new Error('Authentication request has expired. Please request a new code.');
    }

    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
        await challenge.update({ consumedAt: new Date() });
        throw new Error('Too many invalid attempts. Please start again.');
    }

    const table = await RestaurantTable.findOne({
        where: { qrSlug },
        include: [{ model: Restaurant, as: 'restaurant' }]
    });

    if (!table || !table.restaurant) {
        throw new Error('Restaurant table not found');
    }

    if (challenge.restaurantId !== table.restaurantId) {
        await recordChallengeAttempt(challenge, { success: false });
        throw new Error('Authentication request does not match this restaurant.');
    }

    const customer = await Customer.findByPk(challenge.customerId);
    if (!customer) {
        await recordChallengeAttempt(challenge, { success: false });
        throw new Error('Customer account not found.');
    }

    if (!customer.authenticatorEnabled || !customer.authenticatorSecret) {
        throw new Error('Authenticator app is not enabled for this account.');
    }

    const metadata = challenge.metadata || {};
    if (metadata.qrSlug && metadata.qrSlug !== qrSlug) {
        await recordChallengeAttempt(challenge, { success: false });
        throw new Error('Authentication request does not match this table.');
    }

    const valid = authenticator.check(normalizedCode, customer.authenticatorSecret);
    if (!valid) {
        await recordChallengeAttempt(challenge, { success: false });
        throw new Error('Invalid authentication code');
    }

    await recordChallengeAttempt(challenge, { success: true });

    const sessionDetails = await startSession({
        qrSlug,
        customer: {
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phoneNumber: customer.phoneNumber,
            membershipNumber: customer.membershipNumber,
            isMember: true
        }
    });

    return {
        requiresTotp: false,
        ...sessionDetails,
        qrSlug,
        authenticatedWith: AUTH_CHALLENGE_TYPES.TOTP
    };
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
                imageUrl: normalizeAssetUrl(item.imageUrl)
            }))
        }))
    };
};

export const getCustomerProfile = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    const customerRecord = session.customerId ? await Customer.findByPk(session.customerId) : null;
    const membershipRecord =
        session.customerId &&
        (await RestaurantCustomer.findOne({
            where: {
                restaurantId: session.restaurantId,
                customerId: session.customerId
            }
        }));

    const authenticatorEnabled = Boolean(customerRecord?.authenticatorEnabled);
    const authenticatorConfiguredAt = customerRecord?.authenticatorEnabledAt || null;

    return {
        restaurant: {
            id: session.restaurantId,
            name: session.restaurant?.name || null
        },
        table: session.table
            ? {
                  id: session.table.id,
                  name: session.table.name
              }
            : null,
        customer: customerRecord
            ? {
                  id: customerRecord.id,
                  firstName: customerRecord.firstName,
                  lastName: customerRecord.lastName,
                  email: customerRecord.email,
                  phoneNumber: customerRecord.phoneNumber
              }
            : {
                  firstName: session.customerMeta?.firstName || null,
                  lastName: session.customerMeta?.lastName || null,
                  email: session.customerMeta?.email || null,
                  phoneNumber: session.customerMeta?.phoneNumber || null
              },
        membership: membershipRecord
            ? {
                  status: membershipRecord.status,
                  loyaltyPoints: membershipRecord.loyaltyPoints,
                  discountBalanceCents: membershipRecord.discountBalanceCents,
                  pinSetAt: membershipRecord.pinSetAt || null
              }
            : {
                  status: session.membershipStatus
              },
        authenticator: {
            enabled: authenticatorEnabled,
            configuredAt: authenticatorConfiguredAt
        },
        authentication: {
            methods: [
                'PIN',
                ...(authenticatorEnabled && customerRecord?.authenticatorSecret ? ['AUTHENTICATOR'] : [])
            ],
            pinSet: Boolean(membershipRecord?.pinHash),
            pinUpdatedAt: membershipRecord?.pinSetAt || null
        }
    };
};

export const startAuthenticatorSetup = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    if (!session.customerId) {
        throw new Error('Customer details are required before configuring an authenticator.');
    }

    const customer = await Customer.findByPk(session.customerId);
    if (!customer) {
        throw new Error('Customer account not found.');
    }

    const secret = authenticator.generateSecret();

    await customer.update({
        authenticatorSecret: secret,
        authenticatorEnabled: false,
        authenticatorEnabledAt: null
    });

    const otpauthUrl = buildAuthenticatorKeyUri(customer, session.restaurant?.name, secret);
    let qrCodeDataUrl = null;
    if (otpauthUrl) {
        try {
            qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
                errorCorrectionLevel: 'M',
                margin: 1,
                scale: 6
            });
        } catch (error) {
            logger.warn('Failed to render authenticator QR code', {
                message: error.message,
                customerId: customer.id,
                restaurantId: session.restaurantId
            });
        }
    }

    return {
        secret,
        otpauthUrl,
        enabled: false,
        qrCodeDataUrl
    };
};

export const confirmAuthenticatorSetup = async (sessionToken, code) => {
    const session = await resolveSession(sessionToken);

    if (!session.customerId) {
        throw new Error('Customer details are required to verify authenticator codes.');
    }

    const customer = await Customer.findByPk(session.customerId);
    if (!customer || !customer.authenticatorSecret) {
        throw new Error('Authenticator setup has not been initiated.');
    }

    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
        throw new Error('Authentication code is required');
    }

    const valid = authenticator.check(normalizedCode, customer.authenticatorSecret);
    if (!valid) {
        throw new Error('Invalid authentication code');
    }

    const enabledAt = new Date();

    await customer.update({
        authenticatorEnabled: true,
        authenticatorEnabledAt: enabledAt
    });

    return {
        enabled: true,
        configuredAt: enabledAt
    };
};

export const disableAuthenticator = async (sessionToken) => {
    const session = await resolveSession(sessionToken);

    if (!session.customerId) {
        throw new Error('Customer details are required to manage authenticator settings.');
    }

    const customer = await Customer.findByPk(session.customerId);
    if (!customer) {
        throw new Error('Customer account not found.');
    }

    await customer.update({
        authenticatorEnabled: false,
        authenticatorEnabledAt: null,
        authenticatorSecret: null
    });

    return {
        enabled: false
    };
};

export const updateMembershipPin = async (sessionToken, { currentPin, newPin }) => {
    const session = await resolveSession(sessionToken);

    if (!session.customerId) {
        throw new Error('Customer details are required to manage your PIN.');
    }

    const membership = await RestaurantCustomer.findOne({
        where: {
            restaurantId: session.restaurantId,
            customerId: session.customerId
        }
    });

    if (!membership) {
        throw new Error('Membership record not found for this restaurant.');
    }

    const normalizedCurrent = currentPin !== undefined && currentPin !== null ? normalizePin(currentPin) : null;
    const normalizedNew = normalizePin(newPin);

    if (!isValidPinFormat(normalizedNew)) {
        throw new Error(`PIN must be a ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH}-digit number.`);
    }

    if (membership.pinHash) {
        if (!normalizedCurrent) {
            throw new Error('Current PIN is required.');
        }
        const matches = await verifyPin(normalizedCurrent, membership.pinHash);
        if (!matches) {
            throw new Error('Current PIN is incorrect.');
        }
    }

    const pinHash = await hashPin(normalizedNew);
    const pinSetAt = new Date();
    await membership.update({
        pinHash,
        pinSetAt
    });

    return {
        pinUpdatedAt: pinSetAt
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
    const requestedPointsRaw = payload.loyaltyPointsToRedeem;
    const loyaltyPointsRequested = Number.isInteger(requestedPointsRaw)
        ? requestedPointsRaw
        : Number.isFinite(Number.parseInt(requestedPointsRaw, 10))
            ? Number.parseInt(requestedPointsRaw, 10)
            : 0;

    if (loyaltyPointsRequested < 0) {
        throw new Error('Loyalty points to redeem must be zero or a positive integer');
    }

    const requestedCustomerVoucherId = payload.customerVoucherId || null;
    const voucherCode = typeof payload.voucherCode === 'string' ? payload.voucherCode.trim() || null : null;

    if ((requestedCustomerVoucherId || voucherCode) && !session.customerId) {
        throw new Error('You must have a loyalty membership to apply vouchers');
    }

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

        const now = new Date();

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

        if (!membershipRecord && (applyLoyaltyDiscount || loyaltyPointsRequested > 0)) {
            throw new Error('Loyalty discounts require an active membership');
        }

        let customerVoucherRecord = null;
        if (requestedCustomerVoucherId) {
            customerVoucherRecord = await CustomerVoucher.findOne({
                where: {
                    id: requestedCustomerVoucherId,
                    restaurantId: session.restaurantId
                },
                include: [
                    {
                        model: Voucher,
                        as: 'voucher',
                        include: [{ model: VoucherTier, as: 'tiers', required: false }]
                    },
                    { model: Promotion, as: 'promotion', required: false }
                ],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!customerVoucherRecord || customerVoucherRecord.customerId !== session.customerId) {
                throw new Error('Voucher is not available for this session');
            }
        } else if (voucherCode) {
            customerVoucherRecord = await CustomerVoucher.findOne({
                where: {
                    code: voucherCode,
                    customerId: session.customerId,
                    restaurantId: session.restaurantId
                },
                include: [
                    {
                        model: Voucher,
                        as: 'voucher',
                        include: [{ model: VoucherTier, as: 'tiers', required: false }]
                    },
                    { model: Promotion, as: 'promotion', required: false }
                ],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!customerVoucherRecord) {
                throw new Error('Voucher code could not be found for this membership');
            }
        }

        let voucherDiscountCents = 0;
        let appliedVoucherTier = null;
        let appliedPromotionId = null;

        if (customerVoucherRecord) {
            if (customerVoucherRecord.status !== CUSTOMER_VOUCHER_STATUS.AVAILABLE) {
                throw new Error('Voucher has already been used or is no longer available');
            }

            const voucherExpiresAt = normalizeDate(customerVoucherRecord.expiresAt);
            if (voucherExpiresAt && voucherExpiresAt < now) {
                await customerVoucherRecord.update({ status: CUSTOMER_VOUCHER_STATUS.EXPIRED }, { transaction });
                throw new Error('Voucher has expired');
            }

            const voucherPlain = customerVoucherRecord.voucher ? toPlain(customerVoucherRecord.voucher) : null;
            if (!voucherPlain) {
                throw new Error('Voucher details are unavailable');
            }

            if (voucherPlain.status !== VOUCHER_STATUS.ACTIVE) {
                throw new Error('Voucher is not active');
            }

            if (!isWithinSchedule(voucherPlain.validFrom, voucherPlain.validUntil, now)) {
                throw new Error('Voucher cannot be applied at this time');
            }

            const discountResult = computeVoucherDiscountForSubtotal(voucherPlain, subtotalCents);
            if (!discountResult.tier || discountResult.discountCents <= 0) {
                throw new Error('Order total does not meet the voucher requirements');
            }

            if (!voucherPlain.allowStackWithPoints && (applyLoyaltyDiscount || loyaltyPointsRequested > 0)) {
                throw new Error('This voucher cannot be combined with loyalty discounts');
            }

            voucherDiscountCents = discountResult.discountCents;
            appliedVoucherTier = discountResult.tier;
            appliedPromotionId = customerVoucherRecord.promotionId || voucherPlain.promotionId || null;
        }

        const legalDiscountCap = computeLegalDiscountCap(subtotalCents);
        voucherDiscountCents = Math.min(voucherDiscountCents, legalDiscountCap);
        let remainingDiscountCap = Math.max(legalDiscountCap - voucherDiscountCents, 0);

        let loyaltyDiscountFromBalance = 0;
        let loyaltyDiscountFromPoints = 0;
        let loyaltyPointsRedeemed = 0;

        if (membershipRecord) {
            if (applyLoyaltyDiscount && remainingDiscountCap > 0 && membershipRecord.discountBalanceCents > 0) {
                loyaltyDiscountFromBalance = Math.min(membershipRecord.discountBalanceCents, remainingDiscountCap);
                remainingDiscountCap -= loyaltyDiscountFromBalance;
            }

            if (loyaltyPointsRequested > 0) {
                if (loyaltyPointsRequested > membershipRecord.loyaltyPoints) {
                    throw new Error('You do not have enough loyalty points to redeem that amount');
                }

                const maxPointsByCap = Math.floor(remainingDiscountCap / LOYALTY_POINT_VALUE_CENTS);
                if (maxPointsByCap <= 0) {
                    throw new Error('Requested loyalty points exceed the legal discount cap (50% of the order total)');
                }

                loyaltyPointsRedeemed = Math.min(loyaltyPointsRequested, maxPointsByCap);
                loyaltyDiscountFromPoints = loyaltyPointsRedeemed * LOYALTY_POINT_VALUE_CENTS;
                remainingDiscountCap -= loyaltyDiscountFromPoints;
            }
        }

        const loyaltyDiscountCents = loyaltyDiscountFromBalance + loyaltyDiscountFromPoints;
        const discountAppliedCents = voucherDiscountCents + loyaltyDiscountCents;
        const payableCents = Math.max(subtotalCents - discountAppliedCents, 0);
        const earnedLoyaltyPoints = membershipRecord ? Math.floor(payableCents / 100) : 0;

        const order = await Order.create(
            {
                restaurantId: session.restaurantId,
                guestSessionId: session.id,
                customerId: session.customerId,
                customerVoucherId: customerVoucherRecord ? customerVoucherRecord.id : null,
                promotionId: appliedPromotionId,
                status: ORDER_STATUS.PLACED,
                totalCents: payableCents,
                discountAppliedCents,
                voucherDiscountCents,
                loyaltyDiscountCents,
                loyaltyPointsRedeemed,
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
            const nextDiscountBalance = Math.max(membershipRecord.discountBalanceCents - loyaltyDiscountFromBalance, 0);
            const nextLoyaltyPoints = Math.max(membershipRecord.loyaltyPoints - loyaltyPointsRedeemed + earnedLoyaltyPoints, 0);

            await membershipRecord.update(
                {
                    loyaltyPoints: nextLoyaltyPoints,
                    discountBalanceCents: nextDiscountBalance,
                    lastVisitAt: new Date()
                },
                { transaction }
            );

            membershipSummary = {
                loyaltyPoints: nextLoyaltyPoints,
                discountBalanceCents: nextDiscountBalance
            };
        }

        if (customerVoucherRecord) {
            await customerVoucherRecord.update(
                {
                    status: CUSTOMER_VOUCHER_STATUS.REDEEMED,
                    redeemedAt: new Date(),
                    metadata: {
                        ...(customerVoucherRecord.metadata || {}),
                        orderId: order.id,
                        discountCents: voucherDiscountCents,
                        appliedTierId: appliedVoucherTier?.id || null
                    }
                },
                { transaction }
            );
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
            voucherDiscountCents,
            loyaltyDiscountCents,
            loyaltyPointsRedeemed,
            customerVoucherId: customerVoucherRecord ? customerVoucherRecord.id : null,
            promotionId: appliedPromotionId,
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
            },
            {
                model: CustomerVoucher,
                as: 'customerVoucher',
                include: [
                    {
                        model: Voucher,
                        as: 'voucher',
                        attributes: ['id', 'code', 'name']
                    },
                    {
                        model: Promotion,
                        as: 'promotion',
                        attributes: ['id', 'name', 'headline']
                    }
                ]
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

        const customerVoucherPlain = toPlain(order.customerVoucher);
        const voucherSummary = customerVoucherPlain
            ? {
                  id: customerVoucherPlain.id,
                  code: customerVoucherPlain.code,
                  status: customerVoucherPlain.status,
                  claimedAt: customerVoucherPlain.claimedAt,
                  redeemedAt: customerVoucherPlain.redeemedAt,
                  promotion: customerVoucherPlain.promotion
                      ? {
                            id: customerVoucherPlain.promotion.id,
                            name: customerVoucherPlain.promotion.name,
                            headline: customerVoucherPlain.promotion.headline
                        }
                      : null,
                  voucher: customerVoucherPlain.voucher
                      ? {
                            id: customerVoucherPlain.voucher.id,
                            code: customerVoucherPlain.voucher.code,
                            name: customerVoucherPlain.voucher.name
                        }
                      : null
              }
            : null;

        return {
            id: order.id,
            status: order.status,
            totalCents: order.totalCents,
            total: order.totalCents / 100,
            discountAppliedCents: order.discountAppliedCents || 0,
            voucherDiscountCents: order.voucherDiscountCents || 0,
            loyaltyDiscountCents: order.loyaltyDiscountCents || 0,
            loyaltyPointsRedeemed: order.loyaltyPointsRedeemed || 0,
            subtotalCents: order.totalCents + (order.discountAppliedCents || 0),
            customerVoucher: voucherSummary,
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

    const requestedPinRaw = Object.prototype.hasOwnProperty.call(customerPayload, 'pin')
        ? customerPayload.pin
        : null;
    const requestedPin = requestedPinRaw !== null && requestedPinRaw !== undefined ? normalizePin(requestedPinRaw) : null;

    if (requestedPin && !isValidPinFormat(requestedPin)) {
        throw new Error(`PIN must be a ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH}-digit number.`);
    }

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

        if (!membership) {
            throw new Error('Membership could not be created');
        }

        if (!membership.pinHash && !requestedPin) {
            throw new Error('Select a PIN to secure your membership.');
        }

        if (requestedPin) {
            const pinHash = await hashPin(requestedPin);
            await membership.update(
                {
                    pinHash,
                    pinSetAt: new Date()
                },
                { transaction }
            );
        }

        // If the customer is already a member, there's no need to create a verification token or send an email.
        if (membership.status === MEMBERSHIP_STATUS.MEMBER) {
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

