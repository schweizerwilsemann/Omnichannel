import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from '../api/routes/index.js';
import logger from './logger.js';
import env from './env.js';

const createExpressApp = () => {
    const app = express();

    // expose customer app URL (used for email verification redirects)
    try {
        const customerUrl = env.app.customerAppUrl || env.app.appUrl;
        app.set('customerAppUrl', customerUrl);
    } catch (e) {
        // ignore
    }

    app.use(helmet());

    const corsOptions = {
        origin: (_origin, callback) => callback(null, true),
        credentials: false,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
        optionsSuccessStatus: 200
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.use('/api/v1', routes);

    app.use((_req, res, _next) => {
        res.status(404).json({ message: 'Route not found' });
    });

    app.use((err, _req, res, _next) => {
        logger.error('Unhandled error', { message: err.message, stack: err.stack });
        res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
    });

    return app;
};

export default createExpressApp;
