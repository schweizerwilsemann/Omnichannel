import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const customerVerificationTokenModel = (sequelize) =>
    sequelize.define(
        TABLES.CUSTOMER_VERIFICATION_TOKENS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            customerId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'customer_id'
            },
            restaurantId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'restaurant_id'
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false
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
            indexes: [
                {
                    fields: ['restaurant_id', 'customer_id']
                },
                {
                    fields: ['expires_at']
                }
            ]
        }
    );

export default customerVerificationTokenModel;
