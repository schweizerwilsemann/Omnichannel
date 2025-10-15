import multer from 'multer';
import { storageService } from '../services/storage.service.js';
import logger from '../../config/logger.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

const isNotFoundError = (error) => error?.code === 'NoSuchKey' || error?.code === 'NotFound' || error?.statusCode === 404;

export const uploadAsset = [
    upload.single('file'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'File is required' });
        }

        try {
            const result = await storageService.uploadFile(req.file);
            return res.status(201).json({ data: result });
        } catch (error) {
            logger.error('Failed to upload asset', { message: error.message });
            return res.status(500).json({ message: 'Unable to upload asset' });
        }
    }
];

export const listAssets = async (_req, res) => {
    try {
        const items = await storageService.listFiles();
        return res.json({ data: items });
    } catch (error) {
        logger.error('Failed to list assets', { message: error.message });
        return res.status(500).json({ message: 'Unable to list assets' });
    }
};

export const downloadAsset = async (req, res) => {
    const { fileName } = req.params;

    try {
        const { stream, info } = await storageService.getFileStream(fileName);
        const contentType = info?.metaData?.['content-type'] || 'application/octet-stream';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', contentType);
        if (info?.size) {
            res.setHeader('Content-Length', info.size);
        }
        if (info?.lastModified) {
            const lastModified = info.lastModified instanceof Date ? info.lastModified.toUTCString() : new Date(info.lastModified).toUTCString();
            res.setHeader('Last-Modified', lastModified);
        }

        stream.on('error', (error) => {
            logger.error('Stream error while sending asset', { message: error.message });
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

        stream.pipe(res);
    } catch (error) {
        if (isNotFoundError(error)) {
            return res.status(404).json({ message: 'Asset not found' });
        }

        logger.error('Failed to download asset', { message: error.message });
        return res.status(500).json({ message: 'Unable to download asset' });
    }
};

export const deleteAsset = async (req, res) => {
    const { fileName } = req.params;

    try {
        await storageService.deleteFile(fileName);
        return res.status(204).send();
    } catch (error) {
        if (isNotFoundError(error)) {
            return res.status(404).json({ message: 'Asset not found' });
        }

        logger.error('Failed to delete asset', { message: error.message });
        return res.status(500).json({ message: 'Unable to delete asset' });
    }
};
