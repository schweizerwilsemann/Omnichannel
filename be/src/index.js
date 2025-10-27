import createExpressApp from './config/express.js';
import env from './config/env.js';
import sequelize from './config/database.js';
import logger from './config/logger.js';
import './api/models/index.js';
import { initializeStorage } from './api/services/storage.service.js';
import { scheduleRagSyncJob } from './api/services/ragSync.service.js';

const app = createExpressApp();

const start = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connection established');

        await sequelize.sync();
        logger.info('Database models synchronized');

        await initializeStorage();

        app.listen(env.app.port, () => {
            logger.info(`Server listening on port ${env.app.port}`);
        });

        scheduleRagSyncJob();
    } catch (error) {
        logger.error('Failed to start server', { message: error.message });
        process.exit(1);
    }
};

start();
