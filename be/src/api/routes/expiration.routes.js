import { Router } from 'express';
import {
    triggerExpirationCheckController,
    getExpirationStatusController
} from '../controllers/expiration.controller.js';
import authenticateAdmin from '../middlewares/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateAdmin());

// Expiration management routes
router.post('/trigger', triggerExpirationCheckController);
router.get('/status', getExpirationStatusController);

export default router;
