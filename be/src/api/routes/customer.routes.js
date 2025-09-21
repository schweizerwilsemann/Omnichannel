import { Router } from 'express';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    startSessionController,
    getMenuController,
    placeOrderController,
    listOrdersController,
    lookupTableController,
    streamCustomerOrdersController,
    registerMembershipController,
    verifyMembershipController
} from '../controllers/customer.controller.js';
import {
    startSessionSchema,
    sessionTokenQuerySchema,
    placeOrderSchema,
    membershipRegistrationSchema,
    membershipVerifySchema,
    qrSlugQuerySchema
} from '../validations/customer.validation.js';

const router = Router();

router.post('/sessions', validationMiddleware(startSessionSchema), startSessionController);
router.get('/tables/lookup', validationMiddleware(qrSlugQuerySchema, 'query'), lookupTableController);
router.post('/memberships/register', validationMiddleware(membershipRegistrationSchema), registerMembershipController);
router.get('/memberships/verify', validationMiddleware(membershipVerifySchema, 'query'), verifyMembershipController);
router.get('/menu', validationMiddleware(sessionTokenQuerySchema, 'query'), getMenuController);
router.post('/orders', validationMiddleware(placeOrderSchema), placeOrderController);
router.get('/orders/stream', validationMiddleware(sessionTokenQuerySchema, 'query'), streamCustomerOrdersController);
router.get('/orders', validationMiddleware(sessionTokenQuerySchema, 'query'), listOrdersController);

export default router;

