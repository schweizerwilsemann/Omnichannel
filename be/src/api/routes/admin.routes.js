import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    closeGuestSessionController,
    listActiveTablesController,
    getDashboardOverviewController,
    listMenuRecommendationsController
} from '../controllers/admin.controller.js';
import { recommendationAnalyticsQuerySchema } from '../validations/admin.validation.js';

const router = Router();

router.get('/dashboard/overview', authenticateAdmin(), getDashboardOverviewController);
router.get(
    '/menu/recommendations',
    authenticateAdmin(),
    validationMiddleware(recommendationAnalyticsQuerySchema, 'query'),
    listMenuRecommendationsController
);
router.get('/tables/active', authenticateAdmin(), listActiveTablesController);
router.post('/sessions/:sessionId/close', authenticateAdmin(), closeGuestSessionController);

export default router;
