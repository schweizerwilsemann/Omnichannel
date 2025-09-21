import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuItemModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_ITEMS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            categoryId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'category_id'
            },
            sku: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },
            name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            priceCents: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'price_cents'
            },
            isAvailable: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'is_available'
            },
            prepTimeSeconds: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'prep_time_seconds'
            },
            imageUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'image_url'
            }
        },
        {
            underscored: true
        }
    );

export default menuItemModel;
