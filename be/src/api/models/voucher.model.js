import { DataTypes } from 'sequelize';
import { TABLES, VOUCHER_STATUS, DISCOUNT_TYPES } from '../utils/common.js';

const voucherModel = (sequelize) =>
    sequelize.define(
        TABLES.VOUCHERS,
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
            promotionId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'promotion_id'
            },
            code: {
                type: DataTypes.STRING(80),
                allowNull: false
            },
            name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM(...Object.values(VOUCHER_STATUS)),
                allowNull: false,
                defaultValue: VOUCHER_STATUS.ACTIVE
            },
            discountType: {
                type: DataTypes.ENUM(...Object.values(DISCOUNT_TYPES)),
                allowNull: false,
                defaultValue: DISCOUNT_TYPES.PERCENTAGE,
                field: 'discount_type'
            },
            claimsPerCustomer: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                field: 'claims_per_customer'
            },
            totalClaimLimit: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'total_claim_limit'
            },
            validFrom: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'valid_from'
            },
            validUntil: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'valid_until'
            },
            allowStackWithPoints: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'allow_stack_with_points'
            },
            termsUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'terms_url'
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['code', 'restaurant_id']
                },
                {
                    fields: ['promotion_id']
                }
            ]
        }
    );

export default voucherModel;
