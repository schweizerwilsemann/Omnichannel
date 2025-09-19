import { DataTypes } from 'sequelize';
import { TABLES, MEMBERSHIP_STATUS } from '../utils/common.js';

const guestSessionModel = (sequelize) =>
    sequelize.define(
        TABLES.GUEST_SESSIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            restaurantId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'restaurant_id'
            },
            restaurantTableId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'restaurant_table_id'
            },
            customerId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'customer_id'
            },
            membershipStatus: {
                type: DataTypes.ENUM(...Object.values(MEMBERSHIP_STATUS)),
                allowNull: false,
                defaultValue: MEMBERSHIP_STATUS.GUEST,
                field: 'membership_status'
            },
            sessionToken: {
                type: DataTypes.STRING(120),
                allowNull: false,
                unique: true,
                field: 'session_token'
            },
            startedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'started_at'
            },
            closedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'closed_at'
            },
            customerMeta: {
                type: DataTypes.JSON,
                allowNull: true,
                field: 'customer_meta'
            }
        },
        {
            underscored: true
        }
    );

export default guestSessionModel;
