import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// Ensure dotenv loads the be/.env file even when this script is launched from repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const run = async () => {
    let sequelize;
    try {
        // dynamic import after dotenv so DB config picks up env vars
        const dbModule = await import('../config/database.js');
        sequelize = dbModule.default;
        const migration = await import('../../migrations/005-add-discount-balance-to-restaurant-customers.js');

        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected. Running migration 005...');

        const queryInterface = sequelize.getQueryInterface();
        await migration.up(queryInterface, Sequelize);

        console.log('Migration 005 applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exitCode = 1;
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
};

run();
