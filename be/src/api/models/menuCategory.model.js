import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuCategoryModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_CATEGORIES,
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
            name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            sortOrder: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'sort_order'
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'is_active'
            }
        },
        {
            underscored: true
        }
    );

export default menuCategoryModel;
