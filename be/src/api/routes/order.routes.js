import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    listOrdersController,
    getOrderController,
    updateOrderStatusController,
    streamOrdersController,
    updateOrderPaymentController
} from '../controllers/order.controller.js';
import { orderPaymentUpdateSchema } from '../validations/order.validation.js';

const router = Router();

router.get('/stream', streamOrdersController);
router.get('/', authenticateAdmin(), listOrdersController);
router.get('/:orderId', authenticateAdmin(), getOrderController);
router.patch('/:orderId/payment', authenticateAdmin(), validationMiddleware(orderPaymentUpdateSchema), updateOrderPaymentController);
router.patch('/:orderId', authenticateAdmin(), updateOrderStatusController);

export default router;
