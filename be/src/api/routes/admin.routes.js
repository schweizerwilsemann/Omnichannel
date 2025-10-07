import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import { closeGuestSessionController } from '../controllers/admin.controller.js';

const router = Router();

// Close a guest session (admin only)
router.post('/sessions/:sessionId/close', authenticateAdmin(), closeGuestSessionController);

export default router;
