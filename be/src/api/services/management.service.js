import { Op } from 'sequelize';
import models from '../models/index.js';
import { MEMBERSHIP_STATUS, TABLE_STATUS } from '../utils/common.js';
import { normalizeAssetUrl } from './storage.service.js';

const {
    sequelize,
    MenuItem,
    MenuCategory,
    Restaurant,
    RestaurantTable,
    Customer,
    RestaurantCustomer
} = models;

const toPlain = (instance) => (instance ? instance.get({ plain: true }) : null);

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

    const categoryIds = categories.map((category) => category.id);
    const paginationInput = normalizePagination(paginationOptions);

    if (categoryIds.length === 0) {
        return {
            restaurants,
            categories: categories.map((category) => formatCategory(category)).filter(Boolean),
            items: [],
            pagination: buildPaginationMeta(0, paginationInput.page, paginationInput.pageSize)
        };
    }

    const totalItems = await MenuItem.count({
        where: {
            categoryId: { [Op.in]: categoryIds }
        }
    });

    const pagination = buildPaginationMeta(totalItems, paginationInput.page, paginationInput.pageSize);

    const items = await MenuItem.findAll({
        where: {
            categoryId: { [Op.in]: categoryIds }
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

export default {
    listMenuCatalog,
    createMenuItem,
    updateMenuItem,
    listCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    listTables,
    createTable,
    updateTable
};
