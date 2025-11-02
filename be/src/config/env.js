import dotenv from 'dotenv';

dotenv.config();

const env = {
    app: {
        env: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT) || 3301,
        appUrl: process.env.APP_URL || 'http://localhost:3000',
        // Optional explicit customer-facing app URL (overrides appUrl for customer links)
        customerAppUrl: process.env.CUSTOMER_APP_URL || process.env.APP_URL || 'http://localhost:3030'
    },
    jwtSecret: process.env.JWT_SECRET || 'changeme',
    db: {
        name: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        dialect: process.env.DB_DIALECT || 'mysql'
    },
    email: {
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    storage: {
        provider: process.env.STORAGE_PROVIDER || 'minio',
        bucket: process.env.STORAGE_BUCKET || 'omnichannel-assets',
        minio: {
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: Number(process.env.MINIO_PORT) || 9000,
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
            region: process.env.MINIO_REGION || '',
            publicUrl: process.env.MINIO_PUBLIC_URL || ''
        }
    },
    cryptoSecret: process.env.CRYPTO_SECRET_KEY,
    notification: {
        publicKey: process.env.NOTIFICATION_PUBLIC_KEY,
        privateKey: process.env.NOTIFICATION_PRIVATE_KEY,
        email: process.env.NOTIFICATION_USER
    },
    stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        mode: process.env.STRIPE_MODE || 'test'
    },
    rag: {
        baseUrl: process.env.RAG_SERVICE_URL || '',
        adminKey: process.env.RAG_ADMIN_KEY || '',
        autoSync: {
            enabled: process.env.RAG_AUTO_SYNC_ENABLED === 'true',
            intervalMinutes: Number(process.env.RAG_AUTO_SYNC_INTERVAL_MINUTES) || 60
        }
    },
    clarificationModel: {
        url: process.env.CLARIFICATION_MODEL_URL || '',
        adminKey: process.env.CLARIFICATION_MODEL_ADMIN_KEY || process.env.RAG_ADMIN_KEY || '',
        timeoutMs: Number(process.env.CLARIFICATION_MODEL_TIMEOUT_MS) || 1200,
        threshold: Number(process.env.CLARIFICATION_MODEL_PROB_THRESHOLD) || 0.6
    },
    menu: {
        enrichmentPath: process.env.MENU_ENRICHMENT_PATH || ''
    },
    vector: {
        qdrant: {
            host: process.env.QDRANT_HOST || '',
            port: Number(process.env.QDRANT_PORT) || 6333,
            apiKey: process.env.QDRANT_API_KEY || '',
            collection: process.env.QDRANT_COLLECTION || 'menu_similarity',
            useTLS: process.env.QDRANT_USE_TLS === 'true'
        },
        embedding: {
            baseUrl: process.env.EMBEDDING_SERVICE_URL || '',
            apiKey: process.env.EMBEDDING_SERVICE_API_KEY || ''
        }
    },
    plans: {
        standardMonthly: process.env.STANDARD_MONTHLY,
        standardYearly: process.env.STANDARD_YEARLY
    },
    supportEmail: process.env.SUPPORT_EMAIL
};

export default env;
