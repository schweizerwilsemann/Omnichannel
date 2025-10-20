import { DataTypes } from 'sequelize';
import { TABLES, RESTAURANT_STATUS } from '../utils/common.js';

const restaurantModel = (sequelize) =>
    sequelize.define(
        TABLES.RESTAURANTS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            ownerId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'owner_id',
                references: {
                    model: TABLES.USERS,
                    key: 'id'
                }
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false
            },
            address: {
                type: DataTypes.JSON,
                allowNull: true
            },
            businessHours: {
                type: DataTypes.JSON,
                allowNull: true,
                field: 'business_hours'
            },
            timezone: {
                type: DataTypes.STRING(50),
                allowNull: false,
                defaultValue: 'UTC'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(RESTAURANT_STATUS)),
                allowNull: false,
                defaultValue: RESTAURANT_STATUS.ACTIVE
            }
        },
        {
            underscored: true,
            paranoid: true
        }
    );

export default restaurantModel;
