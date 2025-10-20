import models from '../src/api/models/index.js';
import { RESTAURANT_STATUS } from '../src/api/utils/common.js';

export const up = async () => {
    const { User, Restaurant, RestaurantTable } = models;
    
    // Get the owner user
    const owner = await User.findOne({ where: { role: 'OWNER' } });
    
    if (!owner) {
        throw new Error('Owner user not found. Please run users seeder first.');
    }

    // Create main restaurant
    const restaurant = await Restaurant.create({
        ownerId: owner.id,
        name: 'Bella Vista Restaurant',
        address: {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA'
        },
        businessHours: {
            monday: { open: '09:00', close: '22:00' },
            tuesday: { open: '09:00', close: '22:00' },
            wednesday: { open: '09:00', close: '22:00' },
            thursday: { open: '09:00', close: '22:00' },
            friday: { open: '09:00', close: '23:00' },
            saturday: { open: '10:00', close: '23:00' },
            sunday: { open: '10:00', close: '21:00' }
        },
        timezone: 'America/New_York',
        status: RESTAURANT_STATUS.ACTIVE
    });

    // Create restaurant tables
    const tables = [
        { name: 'Table 1', qrSlug: 'table-1-bella-vista', capacity: 2 },
        { name: 'Table 2', qrSlug: 'table-2-bella-vista', capacity: 4 },
        { name: 'Table 3', qrSlug: 'table-3-bella-vista', capacity: 2 },
        { name: 'Table 4', qrSlug: 'table-4-bella-vista', capacity: 6 },
        { name: 'Table 5', qrSlug: 'table-5-bella-vista', capacity: 4 },
        { name: 'Table 6', qrSlug: 'table-6-bella-vista', capacity: 2 },
        { name: 'Table 7', qrSlug: 'table-7-bella-vista', capacity: 8 },
        { name: 'Table 8', qrSlug: 'table-8-bella-vista', capacity: 4 }
    ];

    for (const tableData of tables) {
        await RestaurantTable.create({
            restaurantId: restaurant.id,
            ...tableData
        });
    }

    console.log('✅ Restaurants and tables seeded successfully');
};

export const down = async () => {
    const { Restaurant, RestaurantTable } = models;
    
    await RestaurantTable.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });
    
    console.log('✅ Restaurants unseeded successfully');
};
