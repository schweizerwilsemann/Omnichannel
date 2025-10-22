import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuRecommendationModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_RECOMMENDATIONS,
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
            baseItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'base_item_id'
            },
            recommendedItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'recommended_item_id'
            },
            support: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: false,
                defaultValue: 0
            },
            confidence: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: false,
                defaultValue: 0
            },
            lift: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: false,
                defaultValue: 0
            },
            attachRate: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: false,
                defaultValue: 0,
                field: 'attach_rate'
            },
            supportCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'support_count'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    fields: ['restaurant_id', 'base_item_id']
                },
                {
                    fields: ['restaurant_id', 'recommended_item_id']
                }
            ]
        }
    );

export default menuRecommendationModel;

