import { DataTypes } from 'sequelize';
import { TABLES, CUSTOMER_VOUCHER_STATUS } from '../utils/common.js';

const customerVoucherModel = (sequelize) =>
    sequelize.define(
        TABLES.CUSTOMER_VOUCHERS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            voucherId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'voucher_id'
            },
            promotionId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'promotion_id'
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
            code: {
                type: DataTypes.STRING(120),
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM(...Object.values(CUSTOMER_VOUCHER_STATUS)),
                allowNull: false,
                defaultValue: CUSTOMER_VOUCHER_STATUS.AVAILABLE
            },
            claimChannel: {
                type: DataTypes.STRING(40),
                allowNull: true,
                field: 'claim_channel'
            },
            claimedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'claimed_at'
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'expires_at'
            },
            redeemedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'redeemed_at'
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
                    unique: true,
                    fields: ['voucher_id', 'customer_id']
                },
                {
                    fields: ['customer_id', 'status']
                },
                {
                    fields: ['restaurant_id']
                }
            ]
        }
    );

export default customerVoucherModel;
