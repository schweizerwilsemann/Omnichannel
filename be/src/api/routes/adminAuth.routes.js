import { Router } from 'express';
import validationMiddleware from '../middlewares/validation.middleware.js';
import authenticateAdmin, { ownerOnly } from '../middlewares/auth.middleware.js';
import {
    loginController,
    refreshController,
    logoutController,
    createInvitationController,
    acceptInvitationController,
    requestPasswordResetController,
    resetPasswordController
} from '../controllers/adminAuth.controller.js';
import {
    loginSchema,
    refreshSchema,
    createInvitationSchema,
    acceptInvitationSchema,
    passwordResetRequestSchema,
    passwordResetSchema
} from '../validations/adminAuth.validation.js';

const router = Router();

router.post('/login', validationMiddleware(loginSchema), loginController);
router.post('/refresh', validationMiddleware(refreshSchema), refreshController);
router.post('/logout', authenticateAdmin(), validationMiddleware(refreshSchema), logoutController);
router.post(
    '/invitations',
    ownerOnly,
    validationMiddleware(createInvitationSchema),
    createInvitationController
);
router.post(
    '/invitations/accept',
    validationMiddleware(acceptInvitationSchema),
    acceptInvitationController
);
router.post(
    '/password-reset/request',
    validationMiddleware(passwordResetRequestSchema),
    requestPasswordResetController
);
router.post(
    '/password-reset/confirm',
    validationMiddleware(passwordResetSchema),
    resetPasswordController
);

export default router;
