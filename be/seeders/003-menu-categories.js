import models from '../src/api/models/index.js';

export const up = async () => {
    const { Restaurant, MenuCategory } = models;
    
    // Get the restaurant
    const restaurant = await Restaurant.findOne();
    
    if (!restaurant) {
        throw new Error('Restaurant not found. Please run restaurants seeder first.');
    }

    // Create menu categories
    const categories = [
        { name: 'Appetizers', sortOrder: 1 },
        { name: 'Soups & Salads', sortOrder: 2 },
        { name: 'Main Courses', sortOrder: 3 },
        { name: 'Pasta & Risotto', sortOrder: 4 },
        { name: 'Pizza', sortOrder: 5 },
        { name: 'Desserts', sortOrder: 6 },
        { name: 'Beverages', sortOrder: 7 },
        { name: 'Wine & Cocktails', sortOrder: 8 }
    ];

    for (const categoryData of categories) {
        await MenuCategory.create({
            restaurantId: restaurant.id,
            ...categoryData
        });
    }

    console.log('✅ Menu categories seeded successfully');
};

export const down = async () => {
    const { MenuCategory } = models;
    
    await MenuCategory.destroy({ where: {} });
    
    console.log('✅ Menu categories unseeded successfully');
};
