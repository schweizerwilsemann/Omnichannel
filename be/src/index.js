import createExpressApp from './config/express.js';
import env from './config/env.js';
import sequelize from './config/database.js';
import logger from './config/logger.js';
import './api/models/index.js';
import { initializeStorage } from './api/services/storage.service.js';
import { scheduleRagSyncJob } from './api/services/ragSync.service.js';
import { scheduleExpirationJob } from './api/services/expiration.service.js';
import { rebuildMenuRecommendations } from './api/services/recommendation.service.js';
import cron from 'node-cron';

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

        // Schedule automatic expiration checks for promotions and vouchers
        if (env.expiration?.enabled !== false) {
            const intervalMinutes = env.expiration?.intervalMinutes || 60;
            scheduleExpirationJob(intervalMinutes);
        }

        // Rebuild menu recommendations on startup
        rebuildMenuRecommendations()
            .then(summary => {
                logger.info('Initial menu recommendation rebuild completed on startup.', { restaurants: summary.length });
            })
            .catch(error => {
                logger.error('Initial menu recommendation rebuild failed on startup.', { message: error.message });
            });

        // Schedule daily rebuild of menu recommendations (e.g., at 3:00 AM UTC)
        cron.schedule('0 3 * * *', () => {
            logger.info('Running scheduled daily menu recommendation rebuild...');
            rebuildMenuRecommendations()
                .then(summary => {
                    logger.info('Scheduled menu recommendation rebuild completed.', { restaurants: summary.length });
                })
                .catch(error => {
                    logger.error('Scheduled menu recommendation rebuild failed.', { message: error.message });
                });
        }, {
            scheduled: true,
            timezone: "UTC"
        });
        logger.info('Scheduled daily menu recommendation rebuild at 03:00 UTC.');

    } catch (error) {
        logger.error('Failed to start server', { message: error.message });
        process.exit(1);
    }
};

start();
