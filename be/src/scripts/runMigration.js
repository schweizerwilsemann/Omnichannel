import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('⚠️  Please provide a migration filename, e.g. `node src/scripts/runMigration.js 008-create-promotions-and-vouchers.js`');
    process.exit(1);
}

const migrationFilename = args[0];
const direction = args.includes('--down') ? 'down' : 'up';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const run = async () => {
    let sequelize;
    try {
        console.log(`➡️  Preparing to run migration ${migrationFilename} (${direction})`);

        const [{ default: sequelizeInstance }, { Sequelize }] = await Promise.all([
            import('../config/database.js'),
            import('sequelize')
        ]);

        sequelize = sequelizeInstance;

        const migrationPath = path.resolve(__dirname, '../../migrations', migrationFilename);
        const migrationUrl = pathToFileURL(migrationPath).href;
        const migration = await import(migrationUrl);

        if (!migration[direction]) {
            throw new Error(`Migration ${migrationFilename} does not export a "${direction}" function`);
        }

        console.log('🔌 Connecting to database…');
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const queryInterface = sequelize.getQueryInterface();
        await migration[direction](queryInterface, Sequelize);

        console.log(`🎉 Migration ${migrationFilename} (${direction}) completed successfully.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    } finally {
        if (sequelize) {
            await sequelize.close().catch(() => {});
        }
    }
};

run();
