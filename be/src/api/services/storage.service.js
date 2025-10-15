import {
    ensureBucket as ensureMinioBucket,
    minioClient,
    bucketName,
    getPublicObjectUrl
} from '../../config/minio.js';
import logger from '../../config/logger.js';

class StorageService {
    constructor() {
        this.client = minioClient;
        this.bucket = bucketName;
    }

    async ensureBucket() {
        await ensureMinioBucket();
    }

    isReady() {
        return Boolean(this.client && this.bucket);
    }

    generateSafeName(originalName = '') {
        const name = originalName.normalize('NFKD').replace(/[\s]+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
        const timestamp = Date.now();
        return name ? `${timestamp}-${name}` : `${timestamp}`;
    }

    buildDownloadUrl(fileName) {
        return `/api/v1/assets/${encodeURIComponent(fileName)}`;
    }

    buildPublicUrl(fileName) {
        const publicUrl = getPublicObjectUrl(fileName);
        return publicUrl || null;
    }

    async uploadFile(file) {
        if (!this.isReady()) {
            throw new Error('Storage provider is not configured');
        }

        const fileName = this.generateSafeName(file.originalname);
        await this.client.putObject(this.bucket, fileName, file.buffer, {
            'Content-Type': file.mimetype
        });

        return {
            fileName,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date().toISOString(),
            downloadUrl: this.buildDownloadUrl(fileName),
            publicUrl: this.buildPublicUrl(fileName)
        };
    }

    async listFiles() {
        if (!this.isReady()) {
            throw new Error('Storage provider is not configured');
        }

        return await new Promise((resolve, reject) => {
            const results = [];
            const stream = this.client.listObjectsV2(this.bucket, '', true);

            stream.on('data', (obj) => {
                if (!obj) {
                    return;
                }

                let lastModified;

                if (obj.lastModified instanceof Date) {
                    lastModified = obj.lastModified.toISOString();
                } else if (obj.lastModified) {
                    const parsed = new Date(obj.lastModified);
                    lastModified = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
                } else {
                    lastModified = new Date().toISOString();
                }

                results.push({
                    fileName: obj.name,
                    size: obj.size ?? 0,
                    lastModified,
                    downloadUrl: this.buildDownloadUrl(obj.name),
                    publicUrl: this.buildPublicUrl(obj.name)
                });
            });

            stream.on('end', () => {
                resolve(results);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }

    async getFileStream(fileName) {
        if (!this.isReady()) {
            throw new Error('Storage provider is not configured');
        }

        const info = await this.client.statObject(this.bucket, fileName);
        const stream = await this.client.getObject(this.bucket, fileName);

        return {
            stream,
            info
        };
    }

    async deleteFile(fileName) {
        if (!this.isReady()) {
            throw new Error('Storage provider is not configured');
        }

        await this.client.removeObject(this.bucket, fileName);
    }
}

export const storageService = new StorageService();

export const initializeStorage = async () => {
    try {
        await storageService.ensureBucket();
        logger.info('Storage bucket ready');
    } catch (error) {
        logger.error('Failed to initialize storage', { message: error.message });
        // Do not crash the server if storage is not available; continue startup
    }
};

const buildApiAssetUrl = (fileName) => `/api/v1/assets/${encodeURIComponent(fileName)}`;

const extractFileKeyFromUrl = (inputUrl) => {
    try {
        const parsed = new URL(inputUrl);
        const pathSegments = parsed.pathname.split('/').filter(Boolean);

        const bucketIndex = pathSegments.indexOf(bucketName);
        if (bucketIndex >= 0 && bucketIndex < pathSegments.length - 1) {
            return pathSegments.slice(bucketIndex + 1).join('/');
        }

        if (parsed.hostname.startsWith(`${bucketName}.`)) {
            return pathSegments.join('/');
        }

        return '';
    } catch (error) {
        return '';
    }
};

export const normalizeAssetUrl = (value) => {
    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value)) {
        const key = extractFileKeyFromUrl(value);
        if (key) {
            return buildApiAssetUrl(key);
        }
        return value;
    }

    if (value.startsWith('/')) {
        return value;
    }

    return buildApiAssetUrl(value);
};
