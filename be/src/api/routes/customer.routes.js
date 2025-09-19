import { Router } from 'express';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    startSessionController,
    getMenuController,
    placeOrderController,
    listOrdersController
} from '../controllers/customer.controller.js';
import {
    startSessionSchema,
    sessionTokenQuerySchema,
    placeOrderSchema
} from '../validations/customer.validation.js';

const router = Router();

router.post('/sessions', validationMiddleware(startSessionSchema), startSessionController);
router.get('/menu', validationMiddleware(sessionTokenQuerySchema, 'query'), getMenuController);
router.post('/orders', validationMiddleware(placeOrderSchema), placeOrderController);
router.get('/orders', validationMiddleware(sessionTokenQuerySchema, 'query'), listOrdersController);

export default router;
