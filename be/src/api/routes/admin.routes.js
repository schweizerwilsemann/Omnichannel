import { Router } from 'express';
import authenticateAdmin, { ownerOnly } from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    closeGuestSessionController,
    listActiveTablesController,
    getDashboardOverviewController,
    listMenuRecommendationsController,
    getKnowledgeStatusController,
    triggerKnowledgeSyncController,
    flushKnowledgeCacheController
} from '../controllers/admin.controller.js';
import { recommendationAnalyticsQuerySchema, ragSyncRequestSchema } from '../validations/admin.validation.js';

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
router.get('/knowledge/status', ownerOnly, getKnowledgeStatusController);
router.post(
    '/knowledge/sync',
    ownerOnly,
    validationMiddleware(ragSyncRequestSchema),
    triggerKnowledgeSyncController
);
router.post('/knowledge/cache/flush', ownerOnly, flushKnowledgeCacheController);

export default router;
