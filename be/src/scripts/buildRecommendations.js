import crypto from 'crypto';
import sequelize from '../config/database.js';
import logger from '../config/logger.js';
import { rebuildMenuRecommendations } from '../api/services/recommendation.service.js';

const RUN_ID = crypto.randomUUID();

const main = async () => {
    try {
        logger.info('Starting menu recommendation rebuild', { runId: RUN_ID });
        await sequelize.authenticate();

        const summary = await rebuildMenuRecommendations({ runId: RUN_ID });

        logger.info('Menu recommendations regenerated', {
            runId: RUN_ID,
            restaurantsProcessed: summary.length,
            totals: summary.reduce(
                (acc, row) => {
                    acc.recommendations += row.recommendations || 0;
                    acc.syntheticTransactions += row.syntheticTransactions || 0;
                    acc.historicalTransactions += row.historicalTransactions || 0;
                    return acc;
                },
                { recommendations: 0, syntheticTransactions: 0, historicalTransactions: 0 }
            )
        });

        summary.forEach((row) => {
            logger.info('Recommendation run summary', row);
        });

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to rebuild menu recommendations', {
            runId: RUN_ID,
            message: error.message,
            stack: error.stack
        });
        await sequelize.close();
        process.exit(1);
    }
};

main();

