import {
    login,
    refresh,
    logout,
    createInvitation,
    acceptInvitation,
    requestPasswordReset,
    resetPassword
} from '../services/adminAuth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const buildContext = (req) => ({
    ip: req.ip,
    userAgent: req.headers['user-agent']
});

export const loginController = async (req, res) => {
    try {
        const result = await login(req.body, buildContext(req));
        return successResponse(res, result, 200);
    } catch (error) {
        return errorResponse(res, error.message, 401);
    }
};

export const refreshController = async (req, res) => {
    try {
        const result = await refresh(req.body, buildContext(req));
        return successResponse(res, result, 200);
    } catch (error) {
        return errorResponse(res, error.message, 401);
    }
};

export const logoutController = async (req, res) => {
    try {
        await logout(req.body.refreshToken, req.user?.userId);
        return successResponse(res, { message: 'Logged out' }, 200);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const createInvitationController = async (req, res) => {
    try {
        const data = await createInvitation(
            {
                inviterId: req.user.userId,
                restaurantId: req.body.restaurantId,
                invitee: req.body.invitee
            },
            buildContext(req)
        );
        return successResponse(res, data, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const acceptInvitationController = async (req, res) => {
    try {
        const data = await acceptInvitation(req.body);
        return successResponse(res, data, 200);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const requestPasswordResetController = async (req, res) => {
    try {
        const data = await requestPasswordReset(req.body);
        return successResponse(res, data || { message: 'If the account exists an email will be sent.' }, 200);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const resetPasswordController = async (req, res) => {
    try {
        await resetPassword(req.body);
        return successResponse(res, { message: 'Password updated' }, 200);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};
