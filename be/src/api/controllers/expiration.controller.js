import {
    runExpirationChecks,
    getExpirationJobStatus
} from '../services/expiration.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Manually trigger expiration checks
 */
export const triggerExpirationCheckController = async (req, res) => {
    try {
        const results = await runExpirationChecks();
        return successResponse(res, {
            message: 'Expiration checks completed',
            results
        }, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Failed to run expiration checks', 500);
    }
};

/**
 * Get expiration job status
 */
export const getExpirationStatusController = async (req, res) => {
    try {
        const status = getExpirationJobStatus();
        return successResponse(res, status, 200);
    } catch (error) {
        return errorResponse(res, error.message || 'Failed to get expiration status', 500);
    }
};

export default {
    triggerExpirationCheckController,
    getExpirationStatusController
};
