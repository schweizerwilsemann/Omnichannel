import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const orderItemRatingModel = (sequelize) =>
    sequelize.define(
        TABLES.ORDER_ITEM_RATINGS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            orderId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'order_id'
            },
            orderItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                field: 'order_item_id'
            },
            menuItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'menu_item_id'
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
            rating: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            ratedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'rated_at'
            }
        },
        {
            underscored: true
        }
    );

export default orderItemRatingModel;