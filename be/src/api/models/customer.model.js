import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const customerModel = (sequelize) =>
    sequelize.define(
        TABLES.CUSTOMERS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            firstName: {
                type: DataTypes.STRING(80),
                allowNull: true,
                field: 'first_name'
            },
            lastName: {
                type: DataTypes.STRING(80),
                allowNull: true,
                field: 'last_name'
            },
            email: {
                type: DataTypes.STRING(150),
                allowNull: true,
                unique: true,
                validate: {
                    isEmail: true
                }
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: true,
                unique: true,
                field: 'phone_number'
            },
            membershipNumber: {
                type: DataTypes.STRING(80),
                allowNull: true,
                unique: true,
                field: 'membership_number'
            }
        },
        {
            underscored: true
        }
    );

export default customerModel;
