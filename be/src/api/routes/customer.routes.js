import { Router } from 'express';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    startSessionController,
    requestLoginChallengeController,
    verifyLoginChallengeController,
    getMenuController,
    placeOrderController,
    listOrdersController,
    lookupTableController,
    streamCustomerOrdersController,
    registerMembershipController,
    verifyMembershipController,
    getMembershipStatusController,
    getCustomerProfileController,
    startAuthenticatorSetupController,
    confirmAuthenticatorSetupController,
    disableAuthenticatorController,
    updateMembershipPinController,
    getActiveSessionController,
    listPromotionsController,
    listCustomerVouchersController,
    claimVoucherController,
    claimVoucherByTokenController,
    processPaymentController,
    getPaymentIntentController
} from '../controllers/customer.controller.js';
import {
    startSessionSchema,
    loginChallengeSchema,
    loginVerifySchema,
    sessionTokenQuerySchema,
    sessionTokenBodySchema,
    placeOrderSchema,
    processPaymentSchema,
    membershipRegistrationSchema,
    membershipVerifySchema,
    membershipStatusQuerySchema,
    qrSlugQuerySchema,
    authenticatorVerifySchema,
    pinUpdateSchema,
    voucherClaimSchema,
    voucherEmailClaimSchema,
    paymentIntentParamSchema
} from '../validations/customer.validation.js';

const router = Router();

router.post('/sessions', validationMiddleware(startSessionSchema), startSessionController);
router.post('/auth/login/challenge', validationMiddleware(loginChallengeSchema), requestLoginChallengeController);
router.post('/auth/login/verify', validationMiddleware(loginVerifySchema), verifyLoginChallengeController);
router.get('/tables/lookup', validationMiddleware(qrSlugQuerySchema, 'query'), lookupTableController);
router.post('/memberships/register', validationMiddleware(membershipRegistrationSchema), registerMembershipController);
router.get('/memberships/verify', validationMiddleware(membershipVerifySchema, 'query'), verifyMembershipController);
router.get('/memberships/status', validationMiddleware(membershipStatusQuerySchema, 'query'), getMembershipStatusController);
router.get('/sessions/active', validationMiddleware(sessionTokenQuerySchema, 'query'), getActiveSessionController);
router.get('/profile', validationMiddleware(sessionTokenQuerySchema, 'query'), getCustomerProfileController);
router.post('/profile/authenticator/setup', validationMiddleware(sessionTokenBodySchema), startAuthenticatorSetupController);
router.post('/profile/authenticator/verify', validationMiddleware(authenticatorVerifySchema), confirmAuthenticatorSetupController);
router.delete('/profile/authenticator', validationMiddleware(sessionTokenQuerySchema, 'query'), disableAuthenticatorController);
router.post('/profile/pin', validationMiddleware(pinUpdateSchema), updateMembershipPinController);
router.get('/menu', validationMiddleware(sessionTokenQuerySchema, 'query'), getMenuController);
router.get('/promotions', validationMiddleware(sessionTokenQuerySchema, 'query'), listPromotionsController);
router.get('/vouchers', validationMiddleware(sessionTokenQuerySchema, 'query'), listCustomerVouchersController);
router.post('/vouchers/claim', validationMiddleware(voucherClaimSchema), claimVoucherController);
router.post('/vouchers/email-claim', validationMiddleware(voucherEmailClaimSchema), claimVoucherByTokenController);
router.post('/payments/charge', validationMiddleware(processPaymentSchema), processPaymentController);
router.get(
    '/payments/:paymentIntentId',
    validationMiddleware(paymentIntentParamSchema, 'params'),
    validationMiddleware(sessionTokenQuerySchema, 'query'),
    getPaymentIntentController
);
router.post('/orders', validationMiddleware(placeOrderSchema), placeOrderController);
router.get('/orders/stream', validationMiddleware(sessionTokenQuerySchema, 'query'), streamCustomerOrdersController);
router.get('/orders', validationMiddleware(sessionTokenQuerySchema, 'query'), listOrdersController);
// Allow customers to close their guest session (e.g. when leaving table)
router.post('/sessions/close', validationMiddleware(sessionTokenQuerySchema, 'query'), async (req, res) => {
    try {
        const sessionToken = req.query.sessionToken;
        const result = await (await import('../services/customer.service.js')).closeSessionByToken(sessionToken);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

export default router;






