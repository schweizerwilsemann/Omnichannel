import { Router } from 'express';
import adminAuthRoutes from './adminAuth.routes.js';
import adminRoutes from './admin.routes.js';
import assetRoutes from './asset.routes.js';
import orderRoutes from './order.routes.js';
import customerRoutes from './customer.routes.js';
import managementRoutes from './management.routes.js';

const router = Router();

router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminRoutes);
router.use('/assets', assetRoutes);
router.use('/orders', orderRoutes);
router.use('/customer', customerRoutes);
router.use('/management', managementRoutes);

export default router;

