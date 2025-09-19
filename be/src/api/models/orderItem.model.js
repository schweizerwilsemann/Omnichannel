import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const orderItemModel = (sequelize) =>
    sequelize.define(
        TABLES.ORDER_ITEMS,
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
            menuItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'menu_item_id'
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            priceCentsSnapshot: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'price_cents_snapshot'
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        },
        {
            underscored: true
        }
    );

export default orderItemModel;
