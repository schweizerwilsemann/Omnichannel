import models from '../models/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../../config/logger.js';

const { GuestSession } = models;

export const closeGuestSessionController = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return errorResponse(res, 'Session id is required', 400);
        }

        const session = await GuestSession.findByPk(sessionId);
        if (!session) {
            return errorResponse(res, 'Guest session not found', 404);
        }

        if (session.closedAt) {
            return successResponse(res, { message: 'Session already closed' }, 200);
        }

        await session.update({ closedAt: new Date() });

        logger.info('Guest session closed by admin', { sessionId });

        return successResponse(res, { message: 'Session closed' }, 200);
    } catch (error) {
        logger.error('Failed to close guest session', { message: error.message });
        return errorResponse(res, error.message || 'Unable to close session', 400);
    }
};

export default {
    closeGuestSessionController
};
