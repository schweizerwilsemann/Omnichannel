import { DataTypes } from 'sequelize';
import { TABLES, ORDER_STATUS } from '../utils/common.js';

const orderModel = (sequelize) =>
    sequelize.define(
        TABLES.ORDERS,
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
            guestSessionId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'guest_session_id'
            },
            customerId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'customer_id'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(ORDER_STATUS)),
                allowNull: false,
                defaultValue: ORDER_STATUS.PLACED
            },
            totalCents: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'total_cents'
            },
            specialRequest: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'special_request'
            },
            placedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'placed_at'
            },
            readyAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'ready_at'
            },
            completedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'completed_at'
            }
        },
        {
            underscored: true
        }
    );

export default orderModel;
