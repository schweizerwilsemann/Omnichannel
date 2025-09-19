import dotenv from 'dotenv';

dotenv.config();

const env = {
    app: {
        env: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT) || 3301,
        appUrl: process.env.APP_URL || 'http://localhost:3000'
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
    vnpay: {
        tmnCode: process.env.VNPAY_TMN_CODE,
        hashSecret: process.env.VNPAY_HASH_SECRET,
        apiUrl: process.env.VNPAY_API_URL,
        returnUrl: process.env.VNPAY_RETURN_URL
    },
    plans: {
        standardMonthly: process.env.STANDARD_MONTHLY,
        standardYearly: process.env.STANDARD_YEARLY
    },
    supportEmail: process.env.SUPPORT_EMAIL
};

export default env;
