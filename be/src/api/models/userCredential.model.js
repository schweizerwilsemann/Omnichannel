import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const userCredentialModel = (sequelize) =>
    sequelize.define(
        TABLES.USER_CREDENTIALS,
        {
            userId: {
                type: DataTypes.UUID,
                primaryKey: true,
                references: {
                    model: TABLES.USERS,
                    key: 'id'
                },
                allowNull: false,
                field: 'user_id'
            },
            passwordHash: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'password_hash'
            },
            lastPasswordChangeAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_password_change_at'
            },
            mfaSecret: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'mfa_secret'
            }
        },
        {
            underscored: true
        }
    );

export default userCredentialModel;
