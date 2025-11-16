import { Op } from 'sequelize';
import models from '../models/index.js';
import { RESTAURANT_STATUS } from '../utils/common.js';

const {
    sequelize,
    Restaurant,
    User,
    RestaurantStaff,
    MenuCategory,
    MenuItem,
    RestaurantTable,
    Order
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

// Restaurant CRUD Operations
export const listRestaurants = async (pagination = {}) => {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    const restaurants = await Restaurant.findAndCountAll({
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ],
        order: [['createdAt', 'DESC']],
        offset,
        limit: pageSize
    });

    return {
        restaurants: restaurants.rows.map(toPlain),
        totalItems: restaurants.count,
        page,
        pageSize,
        totalPages: Math.ceil(restaurants.count / pageSize)
    };
};

export const getRestaurant = async (restaurantId) => {
    const restaurant = await Restaurant.findOne({
        where: { id: restaurantId },
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ]
    });

    if (!restaurant) {
        throw new Error('Restaurant not found');
    }

    // Get additional stats
    const [categoryCount, menuItemCount, tableCount, orderCount] = await Promise.all([
        MenuCategory.count({ where: { restaurantId } }),
        MenuItem.count({
            include: [{
                model: MenuCategory,
                as: 'category',
                where: { restaurantId }
            }]
        }),
        RestaurantTable.count({ where: { restaurantId } }),
        Order.count({ where: { restaurantId } })
    ]);

    const restaurantData = toPlain(restaurant);

    return {
        ...restaurantData,
        stats: {
            categoryCount,
            menuItemCount,
            tableCount,
            orderCount
        }
    };
};

export const createRestaurant = async (restaurantData) => {
    const {
        ownerId,
        name,
        address,
        businessHours,
        timezone = 'UTC',
        status = RESTAURANT_STATUS.ACTIVE
    } = restaurantData;

    // Validate owner exists
    const owner = await User.findByPk(ownerId);
    if (!owner) {
        throw new Error('Owner user not found');
    }

    // Check if restaurant name is unique
    const existingRestaurant = await Restaurant.findOne({
        where: { name: name.trim() }
    });

    if (existingRestaurant) {
        throw new Error('Restaurant name already exists');
    }

    // Validate business hours format if provided
    if (businessHours && typeof businessHours !== 'object') {
        throw new Error('Business hours must be a valid JSON object');
    }

    // Validate address format if provided
    if (address && typeof address !== 'object') {
        throw new Error('Address must be a valid JSON object');
    }

    const restaurant = await Restaurant.create({
        ownerId,
        name: name.trim(),
        address,
        businessHours,
        timezone,
        status
    });

    const createdRestaurant = await Restaurant.findOne({
        where: { id: restaurant.id },
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ]
    });

    return toPlain(createdRestaurant);
};

export const updateRestaurant = async (restaurantId, restaurantData) => {
    const restaurant = await Restaurant.findByPk(restaurantId);

    if (!restaurant) {
        throw new Error('Restaurant not found');
    }

    const {
        name,
        address,
        businessHours,
        timezone,
        status
    } = restaurantData;

    // Check if new name conflicts with existing restaurants (excluding current)
    if (name && name.trim() !== restaurant.name) {
        const existingRestaurant = await Restaurant.findOne({
            where: {
                name: name.trim(),
                id: { [Op.ne]: restaurantId }
            }
        });

        if (existingRestaurant) {
            throw new Error('Restaurant name already exists');
        }
    }

    // Validate business hours format if provided
    if (businessHours && typeof businessHours !== 'object') {
        throw new Error('Business hours must be a valid JSON object');
    }

    // Validate address format if provided
    if (address && typeof address !== 'object') {
        throw new Error('Address must be a valid JSON object');
    }

    await restaurant.update({
        ...(name && { name: name.trim() }),
        ...(address !== undefined && { address }),
        ...(businessHours !== undefined && { businessHours }),
        ...(timezone && { timezone }),
        ...(status && { status })
    });

    const updatedRestaurant = await Restaurant.findOne({
        where: { id: restaurantId },
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ]
    });

    return toPlain(updatedRestaurant);
};

export const deleteRestaurant = async (restaurantId) => {
    const restaurant = await Restaurant.findByPk(restaurantId);

    if (!restaurant) {
        throw new Error('Restaurant not found');
    }

    // Check if restaurant has dependencies
    const [categoryCount, tableCount, orderCount] = await Promise.all([
        MenuCategory.count({ where: { restaurantId } }),
        RestaurantTable.count({ where: { restaurantId } }),
        Order.count({ where: { restaurantId } })
    ]);

    if (categoryCount > 0 || tableCount > 0 || orderCount > 0) {
        throw new Error('Cannot delete restaurant with existing menu categories, tables, or orders');
    }

    await restaurant.destroy();
    return { success: true, message: 'Restaurant deleted successfully' };
};

export const getRestaurantsByOwner = async (ownerId, pagination = {}) => {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    const restaurants = await Restaurant.findAndCountAll({
        where: { ownerId },
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ],
        order: [['createdAt', 'DESC']],
        offset,
        limit: pageSize
    });

    return {
        restaurants: restaurants.rows.map(toPlain),
        totalItems: restaurants.count,
        page,
        pageSize,
        totalPages: Math.ceil(restaurants.count / pageSize)
    };
};

export const updateRestaurantStatus = async (restaurantId, status) => {
    const restaurant = await Restaurant.findByPk(restaurantId);

    if (!restaurant) {
        throw new Error('Restaurant not found');
    }

    if (!Object.values(RESTAURANT_STATUS).includes(status)) {
        throw new Error('Invalid restaurant status');
    }

    await restaurant.update({ status });

    const updatedRestaurant = await Restaurant.findOne({
        where: { id: restaurantId },
        include: [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ]
    });

    return toPlain(updatedRestaurant);
};

export default {
    listRestaurants,
    getRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    getRestaurantsByOwner,
    updateRestaurantStatus
};
