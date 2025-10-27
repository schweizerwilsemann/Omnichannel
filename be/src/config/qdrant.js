import { QdrantClient } from '@qdrant/js-client-rest';
import env from './env.js';
import logger from './logger.js';

const vectorSettings = env.vector?.qdrant || {};

let qdrantClient = null;

if (vectorSettings.host) {
    try {
        qdrantClient = new QdrantClient({
            host: vectorSettings.host,
            port: vectorSettings.port,
            apiKey: vectorSettings.apiKey || undefined,
            https: Boolean(vectorSettings.useTLS)
        });
        logger.info('Qdrant client initialised', { host: vectorSettings.host, port: vectorSettings.port });
    } catch (error) {
        logger.warn('Failed to initialise Qdrant client', { message: error.message });
    }
} else {
    logger.info('Qdrant host not configured; similarity search disabled');
}

export default qdrantClient;
