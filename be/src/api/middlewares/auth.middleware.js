import { verifyToken } from '../utils/jwt.js';
import { errorResponse } from '../utils/response.js';
import { USER_ROLES } from '../utils/common.js';

const authenticateAdmin = (allowedRoles = []) => (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return errorResponse(res, 'Authorization header missing', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return errorResponse(res, 'Invalid authorization header', 401);
    }

    try {
        const payload = verifyToken(token);
        if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
            return errorResponse(res, 'Insufficient permissions', 403);
        }

        req.user = payload;
        return next();
    } catch (error) {
        return errorResponse(res, error.message || 'Invalid token', 401);
    }
};

export default authenticateAdmin;
export const ownerOnly = authenticateAdmin([USER_ROLES.OWNER]);
export const managerOrAbove = authenticateAdmin([USER_ROLES.OWNER, USER_ROLES.MANAGER]);
