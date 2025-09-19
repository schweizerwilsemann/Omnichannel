import { DataTypes } from 'sequelize';
import { TABLES, STAFF_STATUS, USER_ROLES } from '../utils/common.js';

const restaurantStaffModel = (sequelize) =>
    sequelize.define(
        TABLES.RESTAURANT_STAFF,
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
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'user_id'
            },
            role: {
                type: DataTypes.ENUM(...Object.values(USER_ROLES)),
                allowNull: false,
                defaultValue: USER_ROLES.MANAGER
            },
            status: {
                type: DataTypes.ENUM(...Object.values(STAFF_STATUS)),
                allowNull: false,
                defaultValue: STAFF_STATUS.ACTIVE
            }
        },
        {
            underscored: true,
            paranoid: true
        }
    );

export default restaurantStaffModel;
