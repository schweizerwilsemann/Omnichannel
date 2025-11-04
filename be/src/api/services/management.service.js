import { Op, fn, col } from 'sequelize';
import models from '../models/index.js';
import {
    MEMBERSHIP_STATUS,
    TABLE_STATUS,
    PROMOTION_STATUS,
    VOUCHER_STATUS,
    DISCOUNT_TYPES,
    CUSTOMER_VOUCHER_STATUS,
    EMAIL_ACTIONS
} from '../utils/common.js';
import { normalizeAssetUrl } from './storage.service.js';
import env from '../../config/env.js';
import { sendEmail } from './email.service.js';
import { signPromotionClaimToken } from '../utils/promotionTokens.js';

const {
    sequelize,
    MenuItem,
    MenuCategory,
    Restaurant,
    RestaurantTable,
    Customer,
    RestaurantCustomer,
    Promotion,
    Voucher,
    VoucherTier,
    CustomerVoucher,
    MenuComboItem
} = models;

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

const parseDateInput = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date value provided');
    }
    return date;
};

const MAX_LEGAL_DISCOUNT_PERCENT = 50;

const normalizePercent = (value) => {
    const percent = Number.parseFloat(value);
    if (!Number.isFinite(percent) || percent < 0) {
        throw new Error('Discount percent must be a positive number');
    }
    if (percent > MAX_LEGAL_DISCOUNT_PERCENT) {
        throw new Error(`Discount percent cannot exceed ${MAX_LEGAL_DISCOUNT_PERCENT}% per policy`);
    }
    return percent;
};

const normalizeInteger = (value, fieldName, { allowNull = true } = {}) => {
    if (value === null || value === undefined || value === '') {
        if (allowNull) {
            return null;
        }
        throw new Error(`${fieldName} is required`);
    }
    const intValue = Number.parseInt(value, 10);
    if (!Number.isInteger(intValue) || intValue < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return intValue;
};

const formatCurrency = (cents) => {
    if (!Number.isFinite(Number(cents))) {
        return '$0.00';
    }
    return `\$${(Number(cents) / 100).toFixed(2)}`;
};

const fetchRestaurants = async (restaurantIds) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return [];
    }

    const rows = await Restaurant.findAll({
        where: { id: { [Op.in]: restaurantIds } },
        attributes: ['id', 'name']
    });

    return rows.map((row) => toPlain(row));
};

const formatCategory = (instance) => {
    const category = toPlain(instance);
    if (!category) {
        return null;
    }

    return {
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        restaurantId: category.restaurantId,
        restaurant: category.restaurant
            ? {
                  id: category.restaurant.id,
                  name: category.restaurant.name
              }
            : null
    };
};

const formatMenuItem = (instance) => {
    const item = toPlain(instance);
    if (!item) {
        return null;
    }

    return {
        id: item.id,
        categoryId: item.categoryId,
        sku: item.sku,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        isAvailable: item.isAvailable,
        isCombo: Boolean(item.isCombo),
        prepTimeSeconds: item.prepTimeSeconds,
        imageUrl: normalizeAssetUrl(item.imageUrl),
        category: item.category
            ? {
                  id: item.category.id,
                  name: item.category.name,
                  restaurantId: item.category.restaurantId
              }
            : null
    };
};

const formatMenuCombo = (instance) => {
    const combo = toPlain(instance);
    if (!combo) {
        return null;
    }

    const components = Array.isArray(combo.comboComponents) ? combo.comboComponents : [];
    const primaryImageSource =
        combo.imageUrl ||
        components.find((component) => component.component && component.component.imageUrl)?.component?.imageUrl ||
        null;

    return {
        id: combo.id,
        categoryId: combo.categoryId,
        restaurantId: combo.category?.restaurantId || null,
        sku: combo.sku,
        name: combo.name,
        description: combo.description,
        priceCents: combo.priceCents,
        isAvailable: combo.isAvailable,
        imageUrl: normalizeAssetUrl(primaryImageSource),
        items: components
            .map((component) => {
                const item = component.component || component.item || null;
                if (!item) {
                    return null;
                }
                return {
                    id: item.id,
                    name: item.name,
                    priceCents: item.priceCents,
                    imageUrl: normalizeAssetUrl(item.imageUrl),
                    quantity: component.quantity || 1,
                    sku: item.sku
                };
            })
            .filter(Boolean)
    };
};

const COMBO_CATEGORY_NAME = 'Combos';
const COMBO_CATEGORY_DEFAULT_SORT = -100;

const buildComboInclude = (restaurantIds = null) => {
    const categoryInclude = {
        model: MenuCategory,
        as: 'category',
        attributes: ['id', 'name', 'restaurantId'],
        required: Boolean(restaurantIds)
    };

    if (restaurantIds) {
        categoryInclude.where = { restaurantId: { [Op.in]: restaurantIds } };
    }

    return [
        categoryInclude,
        {
            model: MenuComboItem,
            as: 'comboComponents',
            include: [
                {
                    model: MenuItem,
                    as: 'component',
                    attributes: ['id', 'name', 'priceCents', 'sku', 'imageUrl'],
                    include: [
                        {
                            model: MenuCategory,
                            as: 'category',
                            attributes: ['id', 'restaurantId'],
                            required: false
                        }
                    ],
                    required: false
                }
            ],
            required: false
        }
    ];
};

const ensureComboCategory = async (restaurantId, { transaction } = {}) => {
    const [category] = await MenuCategory.findOrCreate({
        where: {
            restaurantId,
            name: COMBO_CATEGORY_NAME
        },
        defaults: {
            sortOrder: COMBO_CATEGORY_DEFAULT_SORT,
            isActive: true
        },
        transaction
    });

    return category;
};

const normalizeComboItemsPayload = (items = []) => {
    const accumulator = new Map();
    items.forEach((entry) => {
        const menuItemId = typeof entry.menuItemId === 'string' ? entry.menuItemId.trim() : null;
        if (!menuItemId) {
            return;
        }
        const rawQuantity = Number.isFinite(entry.quantity)
            ? entry.quantity
            : Number.isFinite(Number.parseInt(entry.quantity, 10))
                ? Number.parseInt(entry.quantity, 10)
                : 1;
        const safeQuantity = Math.max(rawQuantity || 0, 1);
        const existing = accumulator.get(menuItemId) || 0;
        accumulator.set(menuItemId, existing + safeQuantity);
    });

    return Array.from(accumulator.entries()).map(([menuItemId, quantity]) => ({
        menuItemId,
        quantity
    }));
};

const fetchComboById = async (comboId, { transaction } = {}) =>
    MenuItem.findByPk(comboId, {
        include: buildComboInclude(),
        transaction
    });

const formatMembership = (instance) => {
    const membership = toPlain(instance);
    if (!membership) {
        return null;
    }

    return {
        id: membership.id,
        restaurantId: membership.restaurantId,
        restaurant: membership.restaurant
            ? {
                  id: membership.restaurant.id,
                  name: membership.restaurant.name
              }
            : null,
        status: membership.status,
        loyaltyPoints: membership.loyaltyPoints,
        discountBalanceCents: membership.discountBalanceCents,
        joinedAt: membership.joinedAt,
        lastVisitAt: membership.lastVisitAt,
        lastClaimedAt: membership.lastClaimedAt,
        customer: membership.customer
            ? {
                  id: membership.customer.id,
                  firstName: membership.customer.firstName,
                  lastName: membership.customer.lastName,
                  email: membership.customer.email,
                  phoneNumber: membership.customer.phoneNumber,
                  membershipNumber: membership.customer.membershipNumber
              }
            : null
    };
};

const formatTable = (instance) => {
    const table = toPlain(instance);
    if (!table) {
        return null;
    }

    return {
        id: table.id,
        restaurantId: table.restaurantId,
        restaurant: table.restaurant
            ? {
                  id: table.restaurant.id,
                  name: table.restaurant.name
              }
            : null,
        name: table.name,
        qrSlug: table.qrSlug,
        capacity: table.capacity,
        status: table.status
    };
};

const formatVoucherTierAdmin = (instance) => {
    const tier = toPlain(instance);
    if (!tier) {
        return null;
    }

    return {
        id: tier.id,
        voucherId: tier.voucherId,
        minSpendCents: tier.minSpendCents,
        discountPercent: Number.parseFloat(tier.discountPercent) || 0,
        maxDiscountCents: tier.maxDiscountCents,
        sortOrder: tier.sortOrder
    };
};

const formatVoucherAdmin = (instance, stats = {}) => {
    const voucher = toPlain(instance);
    if (!voucher) {
        return null;
    }

    return {
        id: voucher.id,
        promotionId: voucher.promotionId,
        restaurantId: voucher.restaurantId,
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
        tiers: (voucher.tiers || []).map(formatVoucherTierAdmin).filter(Boolean),
        stats: {
            totalClaims: stats.totalClaims || 0,
            redeemed: stats.redeemed || 0,
            available: stats.available || 0,
            expired: stats.expired || 0,
            revoked: stats.revoked || 0
        }
    };
};

const formatPromotionAdmin = (instance, voucherStatsMap = new Map()) => {
    const promotion = toPlain(instance);
    if (!promotion) {
        return null;
    }

    return {
        id: promotion.id,
        restaurantId: promotion.restaurantId,
        restaurant: promotion.restaurant
            ? {
                  id: promotion.restaurant.id,
                  name: promotion.restaurant.name
              }
            : null,
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
        vouchers: (promotion.vouchers || []).map((voucher) => {
            const stats = voucherStatsMap.get(voucher.id) || {};
            return formatVoucherAdmin(voucher, stats);
        })
    };
};

const fetchVoucherStats = async (voucherIds = []) => {
    if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
        return new Map();
    }

    const rows = await CustomerVoucher.findAll({
        where: {
            voucherId: { [Op.in]: voucherIds }
        },
        attributes: ['voucherId', 'status', [fn('COUNT', col('id')), 'count']],
        group: ['voucherId', 'status'],
        raw: true
    });

    const statsMap = new Map();
    rows.forEach((row) => {
        const voucherId = row.voucherId;
        const status = row.status;
        const count = Number(row.count) || 0;

        if (!statsMap.has(voucherId)) {
            statsMap.set(voucherId, {
                totalClaims: 0,
                redeemed: 0,
                available: 0,
                expired: 0,
                revoked: 0
            });
        }

        const entry = statsMap.get(voucherId);
        entry.totalClaims += count;

        switch (status) {
            case CUSTOMER_VOUCHER_STATUS.REDEEMED:
                entry.redeemed += count;
                break;
            case CUSTOMER_VOUCHER_STATUS.AVAILABLE:
                entry.available += count;
                break;
            case CUSTOMER_VOUCHER_STATUS.EXPIRED:
                entry.expired += count;
                break;
            case CUSTOMER_VOUCHER_STATUS.REVOKED:
                entry.revoked += count;
                break;
            default:
                break;
        }
    });

    return statsMap;
};

const loadPromotionForRestaurants = async (promotionId, restaurantIds, { transaction, lock } = {}) => {
    const where = { id: promotionId };
    if (Array.isArray(restaurantIds) && restaurantIds.length > 0) {
        where.restaurantId = { [Op.in]: restaurantIds };
    }

    return Promotion.findOne({
        where,
        include: [
            { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] },
            {
                model: Voucher,
                as: 'vouchers',
                required: false,
                include: [{ model: VoucherTier, as: 'tiers', required: false }]
            }
        ],
        transaction,
        lock
    });
};

const buildTierPayloads = (voucherId, tiers = []) => {
    if (!Array.isArray(tiers) || tiers.length === 0) {
        throw new Error('Voucher requires at least one discount tier');
    }

    return tiers.map((tier, index) => {
        const rawMinSpend = tier.minSpendCents ?? tier.minSpend ?? tier.minimumSpend ?? tier.minSpendAmount;
        const minSpendCents = normalizeInteger(rawMinSpend, 'minSpendCents', {
            allowNull: false
        });
        const discountPercent = normalizePercent(tier.discountPercent);
        const maxDiscountCents =
            tier.maxDiscountCents === null || tier.maxDiscountCents === undefined || tier.maxDiscountCents === ''
                ? null
                : normalizeInteger(tier.maxDiscountCents, 'maxDiscountCents');

        return {
            voucherId,
            minSpendCents,
            discountPercent,
            maxDiscountCents,
            sortOrder: index
        };
    });
};

const createVoucherWithTiers = async (promotionRecord, voucherPayload, transaction) => {
    const status = voucherPayload.status || VOUCHER_STATUS.ACTIVE;
    if (!Object.values(VOUCHER_STATUS).includes(status)) {
        throw new Error('Invalid voucher status');
    }

    const discountType = voucherPayload.discountType || DISCOUNT_TYPES.PERCENTAGE;
    if (discountType !== DISCOUNT_TYPES.PERCENTAGE) {
        throw new Error('Only percentage-based vouchers are supported at this time');
    }

    const claimsPerCustomer = voucherPayload.claimsPerCustomer
        ? normalizeInteger(voucherPayload.claimsPerCustomer, 'claimsPerCustomer', { allowNull: false })
        : 1;

    const totalClaimLimit =
        voucherPayload.totalClaimLimit === null || voucherPayload.totalClaimLimit === undefined || voucherPayload.totalClaimLimit === ''
            ? null
            : normalizeInteger(voucherPayload.totalClaimLimit, 'totalClaimLimit');

    const voucher = await Voucher.create(
        {
            restaurantId: promotionRecord.restaurantId,
            promotionId: promotionRecord.id,
            code: voucherPayload.code,
            name: voucherPayload.name,
            description: voucherPayload.description || null,
            status,
            discountType,
            allowStackWithPoints:
                voucherPayload.allowStackWithPoints === undefined ? true : Boolean(voucherPayload.allowStackWithPoints),
            claimsPerCustomer: claimsPerCustomer > 0 ? claimsPerCustomer : 1,
            totalClaimLimit,
            validFrom: parseDateInput(voucherPayload.validFrom) || promotionRecord.startsAt || null,
            validUntil: parseDateInput(voucherPayload.validUntil) || promotionRecord.endsAt || null,
            termsUrl: voucherPayload.termsUrl || null
        },
        { transaction }
    );

    const tierRows = buildTierPayloads(voucher.id, voucherPayload.tiers);
    await VoucherTier.bulkCreate(
        tierRows.map((row) => ({
            ...row
        })),
        { transaction }
    );

    return voucher;
};

const updateVoucherWithTiers = async (voucherInstance, voucherPayload, transaction) => {
    const status = voucherPayload.status || voucherInstance.status;
    if (!Object.values(VOUCHER_STATUS).includes(status)) {
        throw new Error('Invalid voucher status');
    }

    const discountType = voucherPayload.discountType || voucherInstance.discountType || DISCOUNT_TYPES.PERCENTAGE;
    if (discountType !== DISCOUNT_TYPES.PERCENTAGE) {
        throw new Error('Only percentage-based vouchers are supported at this time');
    }

    const claimsPerCustomer =
        voucherPayload.claimsPerCustomer === undefined
            ? voucherInstance.claimsPerCustomer
            : normalizeInteger(voucherPayload.claimsPerCustomer, 'claimsPerCustomer', { allowNull: false });

    const totalClaimLimit =
        voucherPayload.totalClaimLimit === undefined
            ? voucherInstance.totalClaimLimit
            : voucherPayload.totalClaimLimit === null || voucherPayload.totalClaimLimit === ''
              ? null
              : normalizeInteger(voucherPayload.totalClaimLimit, 'totalClaimLimit');

    await voucherInstance.update(
        {
            code: voucherPayload.code || voucherInstance.code,
            name: voucherPayload.name || voucherInstance.name,
            description: voucherPayload.description ?? voucherInstance.description,
            status,
            discountType,
            allowStackWithPoints:
                voucherPayload.allowStackWithPoints === undefined
                    ? voucherInstance.allowStackWithPoints
                    : Boolean(voucherPayload.allowStackWithPoints),
            claimsPerCustomer: claimsPerCustomer > 0 ? claimsPerCustomer : 1,
            totalClaimLimit,
            validFrom:
                voucherPayload.validFrom === undefined
                    ? voucherInstance.validFrom
                    : parseDateInput(voucherPayload.validFrom),
            validUntil:
                voucherPayload.validUntil === undefined
                    ? voucherInstance.validUntil
                    : parseDateInput(voucherPayload.validUntil),
            termsUrl: voucherPayload.termsUrl ?? voucherInstance.termsUrl
        },
        { transaction }
    );

    if (Array.isArray(voucherPayload.tiers)) {
        await VoucherTier.destroy({ where: { voucherId: voucherInstance.id }, transaction });
        const tierRows = buildTierPayloads(voucherInstance.id, voucherPayload.tiers);
        await VoucherTier.bulkCreate(
            tierRows.map((row) => ({
                ...row
            })),
            { transaction }
        );
    }

    return voucherInstance;
};

const DEFAULT_PAGINATION = Object.freeze({
    page: 1,
    pageSize: 10,
    maxPageSize: 50
});

const normalizePagination = (options = {}, defaults = DEFAULT_PAGINATION) => {
    const rawPage = Number.parseInt(options.page, 10);
    const rawPageSize = Number.parseInt(options.pageSize, 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaults.page;
    const maxAllowed = defaults.maxPageSize ?? 100;
    let pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : defaults.pageSize;
    pageSize = Math.min(pageSize, maxAllowed);

    return { page, pageSize };
};

const buildPaginationMeta = (totalItems, page, pageSize) => {
    const safePageSize = Math.max(pageSize, 1);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / safePageSize) : 0;
    const currentPage = totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;

    return {
        page: currentPage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
        hasPrevious: totalPages > 0 && currentPage > 1,
        hasNext: totalPages > 0 && currentPage < totalPages
    };
};

export const listMenuCatalog = async (restaurantIds, paginationOptions = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return { restaurants: [], categories: [], items: [], pagination: buildPaginationMeta(0, 1, DEFAULT_PAGINATION.pageSize) };
    }

    const restaurants = await fetchRestaurants(restaurantIds);
    const categories = await MenuCategory.findAll({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        },
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }],
        order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    const combos = await MenuItem.findAll({
        where: {
            isCombo: true
        },
        include: buildComboInclude(restaurantIds),
        order: [['name', 'ASC']]
    });

    const categoryIds = categories.map((category) => category.id);
    const paginationInput = normalizePagination(paginationOptions);

    if (categoryIds.length === 0) {
        return {
            restaurants,
            categories: categories.map((category) => formatCategory(category)).filter(Boolean),
            items: [],
            combos: combos.map((combo) => formatMenuCombo(combo)).filter(Boolean),
            pagination: buildPaginationMeta(0, paginationInput.page, paginationInput.pageSize)
        };
    }

    const totalItems = await MenuItem.count({
        where: {
            categoryId: { [Op.in]: categoryIds },
            isCombo: false
        }
    });

    const pagination = buildPaginationMeta(totalItems, paginationInput.page, paginationInput.pageSize);

    const items = await MenuItem.findAll({
        where: {
            categoryId: { [Op.in]: categoryIds },
            isCombo: false
        },
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'name', 'restaurantId']
            }
        ],
        order: [['name', 'ASC']],
        limit: pagination.pageSize,
        offset: totalItems > 0 ? (pagination.page - 1) * pagination.pageSize : 0
    });

    return {
        restaurants,
        categories: categories.map((category) => formatCategory(category)).filter(Boolean),
        items: items.map((item) => formatMenuItem(item)).filter(Boolean),
        combos: combos.map((combo) => formatMenuCombo(combo)).filter(Boolean),
        pagination
    };
};

export const createMenuItem = async (restaurantIds, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    const category = await MenuCategory.findOne({
        where: {
            id: payload.categoryId,
            restaurantId: { [Op.in]: restaurantIds }
        }
    });

    if (!category) {
        throw new Error('Category not found or inaccessible');
    }

    const normalizedImageUrl = normalizeAssetUrl(payload.imageUrl);

    const item = await MenuItem.create({
        categoryId: payload.categoryId,
        sku: payload.sku,
        name: payload.name,
        description: payload.description || null,
        priceCents: payload.priceCents,
        isAvailable: typeof payload.isAvailable === 'boolean' ? payload.isAvailable : true,
        prepTimeSeconds: payload.prepTimeSeconds ?? null,
        imageUrl: normalizedImageUrl || null
    });

    const created = await MenuItem.findByPk(item.id, {
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'name', 'restaurantId']
            }
        ]
    });

    return formatMenuItem(created);
};

export const updateMenuItem = async (restaurantIds, menuItemId, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    const menuItem = await MenuItem.findByPk(menuItemId, {
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'restaurantId']
            }
        ]
    });

    if (!menuItem) {
        throw new Error('Menu item not found');
    }

    const currentCategoryRestaurantId = menuItem.category?.restaurantId;
    if (currentCategoryRestaurantId && !restaurantIds.includes(currentCategoryRestaurantId)) {
        throw new Error('You do not have access to this menu item');
    }

    let nextCategoryId = menuItem.categoryId;
    if (payload.categoryId && payload.categoryId !== menuItem.categoryId) {
        const nextCategory = await MenuCategory.findOne({
            where: {
                id: payload.categoryId,
                restaurantId: { [Op.in]: restaurantIds }
            }
        });

        if (!nextCategory) {
            throw new Error('Category not found or inaccessible');
        }

        nextCategoryId = payload.categoryId;
    }

    const updates = {};

    if (payload.sku !== undefined) {
        updates.sku = payload.sku;
    }

    if (payload.name !== undefined) {
        updates.name = payload.name;
    }

    if (payload.description !== undefined) {
        updates.description = payload.description || null;
    }

    if (payload.priceCents !== undefined) {
        updates.priceCents = payload.priceCents;
    }

    if (payload.isAvailable !== undefined) {
        updates.isAvailable = payload.isAvailable;
    }

    if (payload.prepTimeSeconds !== undefined) {
        updates.prepTimeSeconds = payload.prepTimeSeconds ?? null;
    }

    if (payload.imageUrl !== undefined) {
        updates.imageUrl = payload.imageUrl ? normalizeAssetUrl(payload.imageUrl) : null;
    }

    if (nextCategoryId !== menuItem.categoryId) {
        updates.categoryId = nextCategoryId;
    }

    if (Object.keys(updates).length === 0) {
        return formatMenuItem(menuItem);
    }

    await menuItem.update(updates);

    const updated = await MenuItem.findByPk(menuItem.id, {
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'name', 'restaurantId']
            }
        ]
    });

    return formatMenuItem(updated);
};

export const createMenuCombo = async (restaurantIds, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    const restaurantId = payload.restaurantId;
    if (!restaurantId || !restaurantIds.includes(restaurantId)) {
        throw new Error('Restaurant not found or inaccessible');
    }

    const normalizedComponents = normalizeComboItemsPayload(payload.items || payload.components || []);
    if (normalizedComponents.length === 0) {
        throw new Error('Combo must include at least one menu item');
    }

    const componentIds = normalizedComponents.map((entry) => entry.menuItemId);
    const componentRecords = await MenuItem.findAll({
        where: {
            id: { [Op.in]: componentIds },
            isCombo: false
        },
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'restaurantId'],
                where: { restaurantId },
                required: true
            }
        ]
    });

    if (componentRecords.length !== componentIds.length) {
        throw new Error('One or more menu items are unavailable for this combo');
    }

    const normalizedImageUrl = normalizeAssetUrl(payload.imageUrl);

    return sequelize.transaction(async (transaction) => {
        const comboCategory = await ensureComboCategory(restaurantId, { transaction });

        const combo = await MenuItem.create(
            {
                categoryId: comboCategory.id,
                sku: payload.sku,
                name: payload.name,
                description: payload.description || null,
                priceCents: payload.priceCents,
                isAvailable: typeof payload.isAvailable === 'boolean' ? payload.isAvailable : true,
                prepTimeSeconds: payload.prepTimeSeconds ?? null,
                imageUrl: normalizedImageUrl || null,
                isCombo: true
            },
            { transaction }
        );

        const bulkPayload = normalizedComponents.map((entry) => ({
            comboItemId: combo.id,
            menuItemId: entry.menuItemId,
            quantity: entry.quantity
        }));

        await MenuComboItem.bulkCreate(bulkPayload, { transaction });

        const created = await fetchComboById(combo.id, { transaction });
        return formatMenuCombo(created);
    });
};

export const updateMenuCombo = async (restaurantIds, comboId, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    const combo = await MenuItem.findByPk(comboId, {
        include: [
            {
                model: MenuCategory,
                as: 'category',
                attributes: ['id', 'restaurantId']
            }
        ]
    });

    if (!combo || !combo.isCombo) {
        throw new Error('Menu combo not found');
    }

    const comboRestaurantId = combo.category?.restaurantId;
    if (!comboRestaurantId || !restaurantIds.includes(comboRestaurantId)) {
        throw new Error('You do not have access to this combo');
    }

    const updates = {};

    if (payload.sku !== undefined) {
        updates.sku = payload.sku;
    }

    if (payload.name !== undefined) {
        updates.name = payload.name;
    }

    if (payload.description !== undefined) {
        updates.description = payload.description || null;
    }

    if (payload.priceCents !== undefined) {
        updates.priceCents = payload.priceCents;
    }

    if (payload.isAvailable !== undefined) {
        updates.isAvailable = payload.isAvailable;
    }

    if (payload.prepTimeSeconds !== undefined) {
        updates.prepTimeSeconds = payload.prepTimeSeconds ?? null;
    }

    if (payload.imageUrl !== undefined) {
        updates.imageUrl = payload.imageUrl ? normalizeAssetUrl(payload.imageUrl) : null;
    }

    let normalizedComponents = null;
    if (payload.items !== undefined || payload.components !== undefined) {
        normalizedComponents = normalizeComboItemsPayload(payload.items || payload.components || []);
        if (normalizedComponents.length === 0) {
            throw new Error('Combo must include at least one menu item');
        }

        const componentIds = normalizedComponents.map((entry) => entry.menuItemId);
        const componentRecords = await MenuItem.findAll({
            where: {
                id: { [Op.in]: componentIds },
                isCombo: false
            },
            include: [
                {
                    model: MenuCategory,
                    as: 'category',
                    attributes: ['id', 'restaurantId'],
                    where: { restaurantId: comboRestaurantId },
                    required: true
                }
            ]
        });

        if (componentRecords.length !== componentIds.length) {
            throw new Error('One or more selected items are unavailable for this combo');
        }
    }

    return sequelize.transaction(async (transaction) => {
        if (Object.keys(updates).length > 0) {
            await combo.update(updates, { transaction });
        }

        if (Array.isArray(normalizedComponents)) {
            await MenuComboItem.destroy({
                where: { comboItemId: combo.id },
                transaction
            });

            const bulkPayload = normalizedComponents.map((entry) => ({
                comboItemId: combo.id,
                menuItemId: entry.menuItemId,
                quantity: entry.quantity
            }));

            await MenuComboItem.bulkCreate(bulkPayload, { transaction });
        }

        const reloaded = await fetchComboById(combo.id, { transaction });
        return formatMenuCombo(reloaded);
    });
};

const resolveExistingCustomer = async (customerPayload, transaction) => {
    if (!customerPayload) {
        return null;
    }

    const { email, phoneNumber, membershipNumber, id } = customerPayload;

    if (id) {
        const customer = await Customer.findByPk(id, { transaction });
        if (!customer) {
            throw new Error('Customer not found');
        }
        return customer;
    }

    if (email) {
        const byEmail = await Customer.findOne({ where: { email }, transaction });
        if (byEmail) {
            return byEmail;
        }
    }

    if (phoneNumber) {
        const byPhone = await Customer.findOne({ where: { phoneNumber }, transaction });
        if (byPhone) {
            return byPhone;
        }
    }

    if (membershipNumber) {
        const byMembership = await Customer.findOne({ where: { membershipNumber }, transaction });
        if (byMembership) {
            return byMembership;
        }
    }

    return null;
};

const upsertCustomer = async (customerPayload, transaction) => {
    if (!customerPayload) {
        throw new Error('Customer payload is required');
    }

    let customer = await resolveExistingCustomer(customerPayload, transaction);

    const candidateUpdates = {};

    if (customer) {
        if (customerPayload.firstName !== undefined && customer.firstName !== customerPayload.firstName) {
            candidateUpdates.firstName = customerPayload.firstName || null;
        }
        if (customerPayload.lastName !== undefined && customer.lastName !== customerPayload.lastName) {
            candidateUpdates.lastName = customerPayload.lastName || null;
        }
        if (customerPayload.email !== undefined && customer.email !== customerPayload.email) {
            candidateUpdates.email = customerPayload.email || null;
        }
        if (customerPayload.phoneNumber !== undefined && customer.phoneNumber !== customerPayload.phoneNumber) {
            candidateUpdates.phoneNumber = customerPayload.phoneNumber || null;
        }
        if (customerPayload.membershipNumber !== undefined && customer.membershipNumber !== customerPayload.membershipNumber) {
            candidateUpdates.membershipNumber = customerPayload.membershipNumber || null;
        }

        if (Object.keys(candidateUpdates).length > 0) {
            await customer.update(candidateUpdates, { transaction });
        }
    } else {
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
    }

    return customer;
};

export const listCustomers = async (restaurantIds, paginationOptions = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return { restaurants: [], memberships: [], pagination: buildPaginationMeta(0, 1, DEFAULT_PAGINATION.pageSize) };
    }

    const restaurants = await fetchRestaurants(restaurantIds);
    const paginationInput = normalizePagination(paginationOptions);

    const totalItems = await RestaurantCustomer.count({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        }
    });

    const pagination = buildPaginationMeta(totalItems, paginationInput.page, paginationInput.pageSize);

    const memberships = await RestaurantCustomer.findAll({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        },
        include: [
            { model: Customer, as: 'customer' },
            { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }
        ],
        order: [['joinedAt', 'DESC']],
        limit: pagination.pageSize,
        offset: totalItems > 0 ? (pagination.page - 1) * pagination.pageSize : 0
    });

    return {
        restaurants,
        memberships: memberships.map((membership) => formatMembership(membership)).filter(Boolean),
        pagination
    };
};

export const createCustomerMembership = async (restaurantIds, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    if (!restaurantIds.includes(payload.restaurantId)) {
        throw new Error('You do not have access to this restaurant');
    }

    return sequelize.transaction(async (transaction) => {
        const customer = await upsertCustomer(payload.customer, transaction);

        const existingMembership = await RestaurantCustomer.findOne({
            where: {
                restaurantId: payload.restaurantId,
                customerId: customer.id
            },
            transaction
        });

        if (existingMembership) {
            throw new Error('Customer is already linked to this restaurant');
        }

        const membership = await RestaurantCustomer.create(
            {
                restaurantId: payload.restaurantId,
                customerId: customer.id,
                status: payload.status || MEMBERSHIP_STATUS.GUEST,
                loyaltyPoints: payload.loyaltyPoints ?? 0,
                discountBalanceCents: payload.discountBalanceCents ?? 0
            },
            { transaction }
        );

        const reloaded = await RestaurantCustomer.findByPk(membership.id, {
            include: [
                { model: Customer, as: 'customer' },
                { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }
            ],
            transaction
        });

        return formatMembership(reloaded);
    });
};

export const updateCustomerMembership = async (restaurantIds, membershipId, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    return sequelize.transaction(async (transaction) => {
        const membership = await RestaurantCustomer.findByPk(membershipId, {
            include: [
                { model: Customer, as: 'customer' },
                { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }
            ],
            transaction
        });

        if (!membership) {
            throw new Error('Membership not found');
        }

        if (!restaurantIds.includes(membership.restaurantId)) {
            throw new Error('You do not have access to this membership');
        }

        const membershipUpdates = {};

        if (payload.status !== undefined) {
            membershipUpdates.status = payload.status;
        }

        if (payload.loyaltyPoints !== undefined) {
            membershipUpdates.loyaltyPoints = payload.loyaltyPoints;
        }

        if (payload.discountBalanceCents !== undefined) {
            membershipUpdates.discountBalanceCents = payload.discountBalanceCents;
        }

        if (Object.keys(membershipUpdates).length > 0) {
            await membership.update(membershipUpdates, { transaction });
        }

        if (payload.customer) {
            const customerUpdates = {};
            const { customer } = membership;

            if (payload.customer.firstName !== undefined && customer.firstName !== payload.customer.firstName) {
                customerUpdates.firstName = payload.customer.firstName || null;
            }
            if (payload.customer.lastName !== undefined && customer.lastName !== payload.customer.lastName) {
                customerUpdates.lastName = payload.customer.lastName || null;
            }
            if (payload.customer.email !== undefined && customer.email !== payload.customer.email) {
                customerUpdates.email = payload.customer.email || null;
            }
            if (payload.customer.phoneNumber !== undefined && customer.phoneNumber !== payload.customer.phoneNumber) {
                customerUpdates.phoneNumber = payload.customer.phoneNumber || null;
            }
            if (payload.customer.membershipNumber !== undefined && customer.membershipNumber !== payload.customer.membershipNumber) {
                customerUpdates.membershipNumber = payload.customer.membershipNumber || null;
            }

            if (Object.keys(customerUpdates).length > 0) {
                await membership.customer.update(customerUpdates, { transaction });
            }
        }

        const refreshed = await RestaurantCustomer.findByPk(membership.id, {
            include: [
                { model: Customer, as: 'customer' },
                { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }
            ],
            transaction
        });

        return formatMembership(refreshed);
    });
};

export const listTables = async (restaurantIds, paginationOptions = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return { restaurants: [], tables: [], pagination: buildPaginationMeta(0, 1, DEFAULT_PAGINATION.pageSize) };
    }

    const restaurants = await fetchRestaurants(restaurantIds);
    const paginationInput = normalizePagination(paginationOptions);

    const totalItems = await RestaurantTable.count({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        }
    });

    const pagination = buildPaginationMeta(totalItems, paginationInput.page, paginationInput.pageSize);

    const tables = await RestaurantTable.findAll({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        },
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
        limit: pagination.pageSize,
        offset: totalItems > 0 ? (pagination.page - 1) * pagination.pageSize : 0
    });

    return {
        restaurants,
        tables: tables.map((table) => formatTable(table)).filter(Boolean),
        pagination
    };
};

export const createTable = async (restaurantIds, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    if (!restaurantIds.includes(payload.restaurantId)) {
        throw new Error('You do not have access to this restaurant');
    }

    const table = await RestaurantTable.create({
        restaurantId: payload.restaurantId,
        name: payload.name,
        qrSlug: payload.qrSlug,
        capacity: payload.capacity,
        status: payload.status || TABLE_STATUS.AVAILABLE
    });

    const reloaded = await RestaurantTable.findByPk(table.id, {
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }]
    });

    return formatTable(reloaded);
};

export const updateTable = async (restaurantIds, tableId, payload) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    const table = await RestaurantTable.findByPk(tableId, {
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }]
    });

    if (!table) {
        throw new Error('Table not found');
    }

    if (!restaurantIds.includes(table.restaurantId)) {
        throw new Error('You do not have access to this table');
    }

    const updates = {};

    if (payload.name !== undefined) {
        updates.name = payload.name;
    }

    if (payload.qrSlug !== undefined) {
        updates.qrSlug = payload.qrSlug;
    }

    if (payload.capacity !== undefined) {
        updates.capacity = payload.capacity;
    }

    if (payload.status !== undefined) {
        updates.status = payload.status;
    }

    if (Object.keys(updates).length > 0) {
        await table.update(updates);
    }

    const refreshed = await RestaurantTable.findByPk(table.id, {
        include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] }]
    });

    return formatTable(refreshed);
};

export const listPromotions = async (restaurantIds = []) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return [];
    }

    const promotions = await Promotion.findAll({
        where: {
            restaurantId: { [Op.in]: restaurantIds }
        },
        include: [
            { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] },
            {
                model: Voucher,
                as: 'vouchers',
                required: false,
                include: [{ model: VoucherTier, as: 'tiers', required: false }]
            }
        ],
        order: [['startsAt', 'DESC'], ['createdAt', 'DESC']]
    });

    const voucherIds = promotions.flatMap((promotion) => (promotion.vouchers || []).map((voucher) => voucher.id));
    const statsMap = await fetchVoucherStats(voucherIds);

    return promotions.map((promotion) => formatPromotionAdmin(promotion, statsMap)).filter(Boolean);
};

export const getPromotion = async (restaurantIds = [], promotionId) => {
    if (!promotionId) {
        throw new Error('Promotion id is required');
    }

    const promotion = await loadPromotionForRestaurants(promotionId, restaurantIds);
    if (!promotion) {
        throw new Error('Promotion not found');
    }

    if (Array.isArray(restaurantIds) && restaurantIds.length > 0 && !restaurantIds.includes(promotion.restaurantId)) {
        throw new Error('You do not have access to this promotion');
    }

    const statsMap = await fetchVoucherStats((promotion.vouchers || []).map((voucher) => voucher.id));
    return formatPromotionAdmin(promotion, statsMap);
};

export const createPromotion = async (restaurantIds = [], payload = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    if (!payload.restaurantId || !restaurantIds.includes(payload.restaurantId)) {
        throw new Error('You do not have access to this restaurant');
    }

    const status = payload.status || PROMOTION_STATUS.DRAFT;
    if (!Object.values(PROMOTION_STATUS).includes(status)) {
        throw new Error('Invalid promotion status');
    }

    return sequelize.transaction(async (transaction) => {
        const promotion = await Promotion.create(
            {
                restaurantId: payload.restaurantId,
                name: payload.name,
                headline: payload.headline || null,
                description: payload.description || null,
                bannerImageUrl: payload.bannerImageUrl ? normalizeAssetUrl(payload.bannerImageUrl) : null,
                ctaLabel: payload.ctaLabel || null,
                ctaUrl: payload.ctaUrl || null,
                status,
                startsAt: parseDateInput(payload.startsAt),
                endsAt: parseDateInput(payload.endsAt),
                emailSubject: payload.emailSubject || null,
                emailPreviewText: payload.emailPreviewText || null,
                emailBody: payload.emailBody || null
            },
            { transaction }
        );

        const vouchersPayload = Array.isArray(payload.vouchers) ? payload.vouchers : [];
        for (const voucherPayload of vouchersPayload) {
            await createVoucherWithTiers(promotion, voucherPayload, transaction);
        }

        const fullPromotion = await loadPromotionForRestaurants(promotion.id, restaurantIds, { transaction });
        const statsMap = await fetchVoucherStats((fullPromotion?.vouchers || []).map((voucher) => voucher.id));
        return formatPromotionAdmin(fullPromotion, statsMap);
    });
};

export const updatePromotion = async (restaurantIds = [], promotionId, payload = {}) => {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        throw new Error('No restaurants available for this account');
    }

    if (!promotionId) {
        throw new Error('Promotion id is required');
    }

    return sequelize.transaction(async (transaction) => {
        const promotion = await loadPromotionForRestaurants(promotionId, restaurantIds, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!promotion) {
            throw new Error('Promotion not found');
        }

        if (!restaurantIds.includes(promotion.restaurantId)) {
            throw new Error('You do not have access to this promotion');
        }

        const updates = {};

        if (payload.name !== undefined) {
            updates.name = payload.name;
        }
        if (payload.headline !== undefined) {
            updates.headline = payload.headline;
        }
        if (payload.description !== undefined) {
            updates.description = payload.description;
        }
        if (payload.bannerImageUrl !== undefined) {
            updates.bannerImageUrl = payload.bannerImageUrl ? normalizeAssetUrl(payload.bannerImageUrl) : null;
        }
        if (payload.ctaLabel !== undefined) {
            updates.ctaLabel = payload.ctaLabel;
        }
        if (payload.ctaUrl !== undefined) {
            updates.ctaUrl = payload.ctaUrl;
        }
        if (payload.startsAt !== undefined) {
            updates.startsAt = parseDateInput(payload.startsAt);
        }
        if (payload.endsAt !== undefined) {
            updates.endsAt = parseDateInput(payload.endsAt);
        }
        if (payload.emailSubject !== undefined) {
            updates.emailSubject = payload.emailSubject;
        }
        if (payload.emailPreviewText !== undefined) {
            updates.emailPreviewText = payload.emailPreviewText;
        }
        if (payload.emailBody !== undefined) {
            updates.emailBody = payload.emailBody;
        }
        if (payload.status !== undefined) {
            if (!Object.values(PROMOTION_STATUS).includes(payload.status)) {
                throw new Error('Invalid promotion status');
            }
            updates.status = payload.status;
        }

        if (Object.keys(updates).length > 0) {
            await promotion.update(updates, { transaction });
        }

        if (Array.isArray(payload.vouchers)) {
            const existingMap = new Map((promotion.vouchers || []).map((voucher) => [voucher.id, voucher]));

            for (const voucherPayload of payload.vouchers) {
                if (voucherPayload.id && existingMap.has(voucherPayload.id)) {
                    await updateVoucherWithTiers(existingMap.get(voucherPayload.id), voucherPayload, transaction);
                } else {
                    await createVoucherWithTiers(promotion, voucherPayload, transaction);
                }
            }
        }

        const refreshed = await loadPromotionForRestaurants(promotion.id, restaurantIds, { transaction });
        const statsMap = await fetchVoucherStats((refreshed?.vouchers || []).map((voucher) => voucher.id));
        return formatPromotionAdmin(refreshed, statsMap);
    });
};

export const dispatchPromotionEmails = async (restaurantIds = [], promotionId) => {
    if (!promotionId) {
        throw new Error('Promotion id is required');
    }

    const promotionRecord = await loadPromotionForRestaurants(promotionId, restaurantIds);
    if (!promotionRecord) {
        throw new Error('Promotion not found');
    }

    if (Array.isArray(restaurantIds) && restaurantIds.length > 0 && !restaurantIds.includes(promotionRecord.restaurantId)) {
        throw new Error('You do not have access to this promotion');
    }

    const statsMap = await fetchVoucherStats((promotionRecord.vouchers || []).map((voucher) => voucher.id));
    const promotion = formatPromotionAdmin(promotionRecord, statsMap);

    if (!promotion || (promotion.vouchers || []).length === 0) {
        throw new Error('Promotion has no vouchers configured');
    }

    const memberships = await RestaurantCustomer.findAll({
        where: {
            restaurantId: promotion.restaurantId,
            status: MEMBERSHIP_STATUS.MEMBER
        },
        include: [
            {
                model: Customer,
                as: 'customer',
                required: true,
                where: {
                    email: { [Op.ne]: null }
                }
            }
        ]
    });

    const recipients = memberships.filter((membership) => membership.customer?.email);
    if (recipients.length === 0) {
        return {
            promotion,
            attempted: 0,
            sent: 0,
            failed: 0
        };
    }

    const urlSanitizer = /\/+$/;
    const baseUrl = (env.app.customerAppUrl || env.app.appUrl || 'http://localhost:3030').replace(urlSanitizer, '');
    const featuredVoucher = promotion.vouchers[0];
    const maxDiscountPercent = promotion.vouchers.reduce((acc, voucher) => {
        const voucherMax = (voucher.tiers || []).reduce(
            (tierAcc, tier) => Math.max(tierAcc, Number(tier.discountPercent) || 0),
            0
        );
        return Math.max(acc, voucherMax);
    }, 0);

    const emailResults = await Promise.allSettled(
        recipients.map((membership) => {
            const customer = membership.customer;
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email || 'Valued guest';
            const claimToken = signPromotionClaimToken({
                restaurantId: promotion.restaurantId,
                promotionId: promotion.id,
                voucherId: featuredVoucher?.id || null,
                customerId: membership.customerId,
                membershipId: membership.id,
                email: customer.email
            });
            const claimUrl = `${baseUrl}/claim-voucher?token=${encodeURIComponent(claimToken)}`;
            const tiers = (featuredVoucher?.tiers || []).map((tier) => ({
                minSpend: formatCurrency(tier.minSpendCents),
                discountPercent: tier.discountPercent,
                maxDiscount: tier.maxDiscountCents ? formatCurrency(tier.maxDiscountCents) : null
            }));
            const hasTiers = tiers.length > 0;

            return sendEmail(
                {
                    name,
                    emailSubject: promotion.emailSubject,
                    emailPreviewText: promotion.emailPreviewText,
                    promotionName: promotion.name,
                    headline: promotion.headline,
                    description: promotion.description,
                    bannerImageUrl: promotion.bannerImageUrl,
                    ctaLabel: promotion.ctaLabel || 'Claim voucher',
                    claimUrl,
                    voucherCode: featuredVoucher?.code || '',
                    maxDiscountPercent,
                    tiers,
                    hasTiers,
                    legalNotice: `Discounts are capped at ${MAX_LEGAL_DISCOUNT_PERCENT}% per transaction.`,
                    validUntil: featuredVoucher?.validUntil || promotion.endsAt || null
                },
                customer.email,
                EMAIL_ACTIONS.PROMOTION_CAMPAIGN
            );
        })
    );

    const sent = emailResults.filter((entry) => entry.status === 'fulfilled').length;
    const failed = emailResults.length - sent;

    return {
        promotion,
        attempted: emailResults.length,
        sent,
        failed
    };
};

export default {
    listMenuCatalog,
    createMenuItem,
    updateMenuItem,
    listCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    listTables,
    createTable,
    updateTable,
    listPromotions,
    getPromotion,
    createPromotion,
    updatePromotion,
    dispatchPromotionEmails
};
