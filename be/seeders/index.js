import models from '../src/api/models/index.js';
import { up as seedUsers } from './001-users.js';
import { up as seedRestaurants } from './002-restaurants.js';
import { up as seedMenuCategories } from './003-menu-categories.js';
import { up as seedMenuItems } from './004-menu-items.js';
import { up as seedSampleOrders } from './005-sample-orders.js';

const seeders = [
    { name: 'Users', fn: seedUsers },
    { name: 'Restaurants', fn: seedRestaurants },
    { name: 'Menu Categories', fn: seedMenuCategories },
    { name: 'Menu Items', fn: seedMenuItems },
    { name: 'Sample Orders', fn: seedSampleOrders }
];

export const seed = async () => {
    try {
        console.log('🌱 Starting database seeding...\n');
        
        // Test database connection
        console.log('🔌 Testing database connection...');
        await models.sequelize.authenticate();
        console.log('✅ Database connection established\n');

        // Run all seeders in sequence
        for (const seeder of seeders) {
            console.log(`📦 Seeding ${seeder.name}...`);
            await seeder.fn();
            console.log(`✅ ${seeder.name} completed\n`);
        }

        console.log('🎉 All seeders completed successfully!');
        console.log('\n📊 Summary:');
        console.log('- 2 Users (Owner & Manager)');
        console.log('- 1 Restaurant with 8 tables');
        console.log('- 8 Menu categories');
        console.log('- 25 Menu items with food images');
        console.log('- 2 Sample orders with order items');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        await models.sequelize.close();
    }
};

// Run seeder if called directly
console.log('🚀 Starting seeder script...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

seed().then(() => {
    console.log('✅ Seeder completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Seeder failed:', error);
    process.exit(1);
});
