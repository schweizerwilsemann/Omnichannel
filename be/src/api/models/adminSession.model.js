import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const adminSessionModel = (sequelize) =>
    sequelize.define(
        TABLES.ADMIN_SESSIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'user_id',
                references: {
                    model: TABLES.USERS,
                    key: 'id'
                }
            },
            refreshTokenHash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'refresh_token_hash'
            },
            encryptedPayload: {
                type: DataTypes.JSON,
                allowNull: true,
                field: 'encrypted_payload'
            },
            userAgent: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'user_agent'
            },
            ipAddress: {
                type: DataTypes.STRING(45),
                allowNull: true,
                field: 'ip_address'
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'expires_at'
            },
            revokedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'revoked_at'
            }
        },
        {
            underscored: true
        }
    );

export default adminSessionModel;
