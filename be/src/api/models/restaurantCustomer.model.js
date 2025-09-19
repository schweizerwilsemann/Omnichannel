import { DataTypes } from 'sequelize';
import { TABLES, MEMBERSHIP_STATUS } from '../utils/common.js';

const restaurantCustomerModel = (sequelize) =>
    sequelize.define(
        TABLES.RESTAURANT_CUSTOMERS,
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
            customerId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'customer_id'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(MEMBERSHIP_STATUS)),
                allowNull: false,
                defaultValue: MEMBERSHIP_STATUS.GUEST
            },
            loyaltyPoints: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'loyalty_points'
            },
            joinedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'joined_at'
            },
            lastVisitAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_visit_at'
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['restaurant_id', 'customer_id']
                }
            ]
        }
    );

export default restaurantCustomerModel;
