import { DataTypes } from 'sequelize';
import { TABLES, USER_ROLES, USER_STATUS } from '../utils/common.js';

const userModel = (sequelize) =>
    sequelize.define(
        TABLES.USERS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            firstName: {
                type: DataTypes.STRING(50),
                allowNull: false,
                field: 'first_name'
            },
            lastName: {
                type: DataTypes.STRING(50),
                allowNull: false,
                field: 'last_name'
            },
            email: {
                type: DataTypes.STRING(150),
                allowNull: false,
                unique: true
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: true,
                field: 'phone_number'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(USER_STATUS)),
                allowNull: false,
                defaultValue: USER_STATUS.ACTIVE
            },
            role: {
                type: DataTypes.ENUM(...Object.values(USER_ROLES)),
                allowNull: false,
                defaultValue: USER_ROLES.MANAGER
            }
        },
        {
            paranoid: true,
            underscored: true
        }
    );

export default userModel;
