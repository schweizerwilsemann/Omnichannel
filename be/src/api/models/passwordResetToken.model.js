import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const passwordResetTokenModel = (sequelize) =>
    sequelize.define(
        TABLES.PASSWORD_RESET_TOKENS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'user_id'
            },
            tokenHash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'token_hash'
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'expires_at'
            },
            usedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'used_at'
            }
        },
        {
            underscored: true,
            paranoid: false
        }
    );

export default passwordResetTokenModel;
