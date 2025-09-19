import * as Minio from 'minio';
import env from './env.js';
import logger from './logger.js';

const { provider, bucket, minio: minioConfig } = env.storage;

let client = null;

if (provider === 'minio') {
    client = new Minio.Client({
        endPoint: minioConfig.endPoint,
        port: minioConfig.port,
        useSSL: minioConfig.useSSL,
        accessKey: minioConfig.accessKey,
        secretKey: minioConfig.secretKey
    });
}

export const minioClient = client;
export const bucketName = bucket;

export const ensureBucket = async () => {
    if (!minioClient) {
        logger.warn('MinIO client not configured; storage provider disabled.');
        return;
    }

    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            const region = env.storage.minio.region;
            if (region) {
                await minioClient.makeBucket(bucketName, region);
            } else {
                await minioClient.makeBucket(bucketName);
            }
            logger.info(`MinIO bucket "${bucketName}" created`);
        }
    } catch (error) {
        logger.error('Failed to ensure MinIO bucket', { message: error.message });
        throw error;
    }
};

export const getPublicObjectUrl = (objectName) => {
    const { publicUrl } = env.storage.minio;
    if (!publicUrl) {
        return '';
    }

    return `${publicUrl.replace(/\/$/, '')}/${objectName}`;
};
