import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const customerAuthChallengeModel = (sequelize) =>
    sequelize.define(
        TABLES.CUSTOMER_AUTH_CHALLENGES,
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
            challengeType: {
                type: DataTypes.STRING(32),
                allowNull: false,
                field: 'challenge_type'
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'expires_at'
            },
            consumedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'consumed_at'
            },
            attempts: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    fields: ['customer_id', 'restaurant_id']
                },
                {
                    fields: ['expires_at']
                }
            ]
        }
    );

export default customerAuthChallengeModel;
