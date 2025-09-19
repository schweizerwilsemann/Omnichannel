import { DataTypes } from 'sequelize';
import { TABLES, USER_ROLES, INVITATION_STATUS } from '../utils/common.js';

const adminInvitationModel = (sequelize) =>
    sequelize.define(
        TABLES.ADMIN_INVITATIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            inviterId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'inviter_id'
            },
            restaurantId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'restaurant_id'
            },
            tokenIdentifier: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                defaultValue: DataTypes.UUIDV4,
                field: 'token_identifier'
            },
            email: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            firstName: {
                type: DataTypes.STRING(50),
                allowNull: false,
                field: 'first_name'
            },
            lastName: {
                type: DataTypes.STRING(50),
                allowNull: false,
                field: 'last_name'
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: false,
                field: 'phone_number'
            },
            role: {
                type: DataTypes.ENUM(...Object.values(USER_ROLES)),
                allowNull: false,
                defaultValue: USER_ROLES.MANAGER
            },
            tokenHash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'token_hash'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(INVITATION_STATUS)),
                allowNull: false,
                defaultValue: INVITATION_STATUS.PENDING
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'expires_at'
            }
        },
        {
            underscored: true,
            paranoid: true
        }
    );

export default adminInvitationModel;
