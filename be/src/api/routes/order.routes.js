import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import {
    listOrdersController,
    getOrderController,
    updateOrderStatusController,
    streamOrdersController
} from '../controllers/order.controller.js';

const router = Router();

router.get('/stream', streamOrdersController);
router.get('/', authenticateAdmin(), listOrdersController);
router.get('/:orderId', authenticateAdmin(), getOrderController);
router.patch('/:orderId', authenticateAdmin(), updateOrderStatusController);

export default router;
