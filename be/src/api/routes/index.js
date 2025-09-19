import { Router } from 'express';
import adminAuthRoutes from './adminAuth.routes.js';
import assetRoutes from './asset.routes.js';
import customerRoutes from './customer.routes.js';

const router = Router();

router.use('/admin/auth', adminAuthRoutes);
router.use('/assets', assetRoutes);
router.use('/customer', customerRoutes);

export default router;
