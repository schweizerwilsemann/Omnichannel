import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const voucherTierModel = (sequelize) =>
    sequelize.define(
        TABLES.VOUCHER_TIERS,
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
            minSpendCents: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'min_spend_cents'
            },
            discountPercent: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                field: 'discount_percent'
            },
            maxDiscountCents: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'max_discount_cents'
            },
            sortOrder: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'sort_order'
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    fields: ['voucher_id', 'min_spend_cents']
                }
            ]
        }
    );

export default voucherTierModel;
