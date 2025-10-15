import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import { closeGuestSessionController, listActiveTablesController, getDashboardOverviewController } from '../controllers/admin.controller.js';

const router = Router();

router.get('/dashboard/overview', authenticateAdmin(), getDashboardOverviewController);
router.get('/tables/active', authenticateAdmin(), listActiveTablesController);
router.post('/sessions/:sessionId/close', authenticateAdmin(), closeGuestSessionController);

export default router;

