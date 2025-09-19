import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import models from '../models/index.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { encrypt } from '../utils/crypto.js';
import logger from '../../config/logger.js';
import { sendEmail } from './email.service.js';
import {
    SECURITY_EVENT_TYPES,
    USER_STATUS,
    USER_ROLES,
    STAFF_STATUS,
    INVITATION_STATUS,
    RECIPIENT_TYPE,
    NOTIFICATION_CHANNEL,
    EMAIL_ACTIONS
} from '../utils/common.js';

const {
    User,
    UserCredential,
    AdminSession,
    AdminInvitation,
    RestaurantStaff,
    PasswordResetToken,
    SecurityEvent,
    Restaurant,
    Notification
} = models;

const SALT_ROUNDS = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

const recordSecurityEvent = async (type, userId, metadata = {}) => {
    await SecurityEvent.create({ type, userId, metadata });
};

const attachRestaurantContext = (user) => {
    if (!user) {
        return [];
    }

    if (user.role === USER_ROLES.OWNER) {
        return (user.restaurants || []).map((r) => r.id);
    }

    return (user.restaurantAssignments || [])
        .filter((assignment) => assignment.status === STAFF_STATUS.ACTIVE)
        .map((assignment) => assignment.restaurantId);
};

const rotateRefreshToken = async ({ user, context, sessionToRevoke = null, eventType = SECURITY_EVENT_TYPES.LOGIN_SUCCESS }) => {
    const restaurantIds = attachRestaurantContext(user);
    const payload = {
        userId: user.id,
        role: user.role,
        restaurantIds
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    if (sessionToRevoke) {
        sessionToRevoke.revokedAt = new Date();
        await sessionToRevoke.save();
    }

    const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    let encryptedPayload = null;

    try {
        encryptedPayload = encrypt(refreshToken);
    } catch (error) {
        logger.warn('Unable to encrypt refresh token', { message: error.message });
    }

    await AdminSession.create({
        userId: user.id,
        refreshTokenHash,
        encryptedPayload,
        userAgent: context.userAgent,
        ipAddress: context.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
    });

    await recordSecurityEvent(eventType, user.id, {
        ip: context.ip,
        userAgent: context.userAgent,
        rotated: Boolean(sessionToRevoke)
    });

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            restaurantIds
        }
    };
};

export const login = async (body, context) => {
    const { email, password } = body;

    const user = await User.findOne({
        where: { email },
        include: [
            { model: UserCredential, as: 'credential' },
            { model: Restaurant, as: 'restaurants' },
            { model: RestaurantStaff, as: 'restaurantAssignments' }
        ]
    });

    if (!user || !user.credential) {
        await recordSecurityEvent(SECURITY_EVENT_TYPES.LOGIN_FAILURE, user ? user.id : null, {
            email,
            reason: 'USER_NOT_FOUND'
        });
        throw new Error('Invalid credentials');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
        throw new Error('User is inactive');
    }

    const passwordMatch = await bcrypt.compare(password, user.credential.passwordHash);

    if (!passwordMatch) {
        await recordSecurityEvent(SECURITY_EVENT_TYPES.LOGIN_FAILURE, user.id, {
            email,
            reason: 'INVALID_PASSWORD'
        });
        throw new Error('Invalid credentials');
    }

    return rotateRefreshToken({ user, context });
};

export const refresh = async (body, context) => {
    const { refreshToken } = body;

    const decoded = verifyToken(refreshToken);

    const session = await AdminSession.findOne({
        where: {
            userId: decoded.userId,
            revokedAt: null
        },
        order: [['created_at', 'DESC']]
    });

    if (!session) {
        throw new Error('Session not found');
    }

    if (session.expiresAt < new Date()) {
        session.revokedAt = new Date();
        await session.save();
        throw new Error('Session expired');
    }

    const tokenMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!tokenMatch) {
        session.revokedAt = new Date();
        await session.save();
        throw new Error('Refresh token mismatch');
    }

    const user = await User.findByPk(decoded.userId, {
        include: [
            { model: UserCredential, as: 'credential' },
            { model: Restaurant, as: 'restaurants' },
            { model: RestaurantStaff, as: 'restaurantAssignments' }
        ]
    });

    if (!user || user.status !== USER_STATUS.ACTIVE) {
        throw new Error('User unavailable');
    }

    return rotateRefreshToken({
        user,
        context,
        sessionToRevoke: session,
        eventType: SECURITY_EVENT_TYPES.TOKEN_REVOKED
    });
};

export const logout = async (refreshToken, userId) => {
    if (!refreshToken) {
        return;
    }

    const decoded = verifyToken(refreshToken);
    if (decoded.userId !== userId) {
        throw new Error('Invalid token owner');
    }

    const session = await AdminSession.findOne({
        where: {
            userId,
            revokedAt: null
        },
        order: [['created_at', 'DESC']]
    });

    if (session) {
        session.revokedAt = new Date();
        await session.save();
        await recordSecurityEvent(SECURITY_EVENT_TYPES.TOKEN_REVOKED, userId, { reason: 'LOGOUT' });
    }
};

export const createInvitation = async ({ inviterId, restaurantId, invitee }, context) => {
    const inviter = await User.findByPk(inviterId, { include: [{ model: Restaurant, as: 'restaurants' }] });
    if (!inviter || inviter.role !== USER_ROLES.OWNER) {
        throw new Error('Only owners can invite managers');
    }

    const ownsRestaurant = (inviter.restaurants || []).some((restaurant) => restaurant.id === restaurantId);
    if (!ownsRestaurant) {
        throw new Error('Inviter does not own the specified restaurant');
    }

    const token = uuid();
    const tokenIdentifier = uuid();
    const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);

    const invitation = await AdminInvitation.create({
        inviterId,
        restaurantId,
        tokenIdentifier,
        email: invitee.email,
        firstName: invitee.firstName,
        lastName: invitee.lastName,
        phoneNumber: invitee.phoneNumber,
        role: invitee.role ?? USER_ROLES.MANAGER,
        tokenHash,
        status: INVITATION_STATUS.PENDING,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
    });

    await Notification.create({
        recipientType: RECIPIENT_TYPE.ADMIN,
        recipientReference: inviterId,
        channel: NOTIFICATION_CHANNEL.EMAIL,
        templateKey: 'ADMIN_INVITATION',
        payload: {
            invitationId: invitation.id,
            token,
            tokenIdentifier,
            inviteeEmail: invitee.email
        }
    });

    await recordSecurityEvent(SECURITY_EVENT_TYPES.LOGIN_SUCCESS, inviterId, {
        action: 'INVITATION_CREATED',
        invitationId: invitation.id,
        ip: context.ip
    });

    return { invitationId: invitation.id, token, tokenIdentifier };
};

export const acceptInvitation = async ({ tokenIdentifier, token, password, phoneNumber }) => {
    const invitation = await AdminInvitation.findOne({ where: { tokenIdentifier, status: INVITATION_STATUS.PENDING } });

    if (!invitation) {
        throw new Error('Invitation not found');
    }

    if (invitation.expiresAt < new Date()) {
        invitation.status = INVITATION_STATUS.EXPIRED;
        await invitation.save();
        throw new Error('Invitation expired');
    }

    const tokenMatch = await bcrypt.compare(token, invitation.tokenHash);
    if (!tokenMatch) {
        throw new Error('Invalid invitation token');
    }

    let user = await User.findOne({ where: { email: invitation.email } });

    if (!user) {
        user = await User.create({
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            email: invitation.email,
            phoneNumber: phoneNumber || invitation.phoneNumber,
            role: invitation.role,
            status: USER_STATUS.ACTIVE
        });

        await UserCredential.create({
            userId: user.id,
            passwordHash: await bcrypt.hash(password, SALT_ROUNDS)
        });

        try {
            await sendEmail(
                {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                },
                user.email,
                EMAIL_ACTIONS.ACCOUNT_CREATED
            );
        } catch (emailError) {
            logger.warn('Failed to send account creation email', { message: emailError.message });
        }
    } else {
        await UserCredential.update(
            {
                passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
                lastPasswordChangeAt: new Date()
            },
            { where: { userId: user.id } }
        );
    }

    await RestaurantStaff.findOrCreate({
        where: { restaurantId: invitation.restaurantId, userId: user.id },
        defaults: { role: invitation.role }
    });

    invitation.status = INVITATION_STATUS.ACCEPTED;
    await invitation.save();

    await recordSecurityEvent(SECURITY_EVENT_TYPES.PASSWORD_RESET_COMPLETED, user.id, { reason: 'INVITATION_ACCEPTED' });

    return { userId: user.id };
};

export const requestPasswordReset = async ({ email }) => {
    const user = await User.findOne({ where: { email }, include: [{ model: UserCredential, as: 'credential' }] });
    if (!user || !user.credential) {
        return;
    }

    const token = uuid();
    const tokenIdentifier = uuid();
    const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);

    const resetRecord = await PasswordResetToken.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS)
    });

    await Notification.create({
        recipientType: RECIPIENT_TYPE.ADMIN,
        recipientReference: user.id,
        channel: NOTIFICATION_CHANNEL.EMAIL,
        templateKey: 'PASSWORD_RESET',
        payload: {
            token,
            tokenIdentifier,
            resetId: resetRecord.id
        }
    });

    await recordSecurityEvent(SECURITY_EVENT_TYPES.PASSWORD_RESET_REQUESTED, user.id, {});

    return { resetId: resetRecord.id, token, tokenIdentifier };
};

export const resetPassword = async ({ resetId, token, password }) => {
    const resetRecord = await PasswordResetToken.findByPk(resetId);

    if (!resetRecord || resetRecord.usedAt) {
        throw new Error('Reset token invalid');
    }

    if (resetRecord.expiresAt < new Date()) {
        throw new Error('Reset token expired');
    }

    const tokenMatch = await bcrypt.compare(token, resetRecord.tokenHash);
    if (!tokenMatch) {
        throw new Error('Reset token invalid');
    }

    await UserCredential.update(
        {
            passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
            lastPasswordChangeAt: new Date()
        },
        { where: { userId: resetRecord.userId } }
    );

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    await AdminSession.update(
        { revokedAt: new Date() },
        { where: { userId: resetRecord.userId, revokedAt: null } }
    );

    await recordSecurityEvent(SECURITY_EVENT_TYPES.PASSWORD_RESET_COMPLETED, resetRecord.userId, {});
};
