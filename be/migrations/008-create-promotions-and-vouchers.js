import { DataTypes } from 'sequelize';

const PROMOTION_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED'];
const VOUCHER_STATUSES = ['ACTIVE', 'INACTIVE'];
const CUSTOMER_VOUCHER_STATUSES = ['AVAILABLE', 'REDEEMED', 'EXPIRED', 'REVOKED'];
const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'];

export const up = async (queryInterface) => {
    await queryInterface.createTable('promotions', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'restaurants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        headline: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        banner_image_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        cta_label: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        cta_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM(...PROMOTION_STATUSES),
            allowNull: false,
            defaultValue: 'DRAFT'
        },
        starts_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        ends_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        email_subject: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        email_preview_text: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        email_body: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.createTable('vouchers', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'restaurants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        promotion_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'promotions',
                key: 'id'
            },
            onDelete: 'SET NULL'
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
            type: DataTypes.ENUM(...VOUCHER_STATUSES),
            allowNull: false,
            defaultValue: 'ACTIVE'
        },
        discount_type: {
            type: DataTypes.ENUM(...DISCOUNT_TYPES),
            allowNull: false,
            defaultValue: 'PERCENTAGE'
        },
        claims_per_customer: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        total_claim_limit: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        valid_from: {
            type: DataTypes.DATE,
            allowNull: true
        },
        valid_until: {
            type: DataTypes.DATE,
            allowNull: true
        },
        allow_stack_with_points: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        terms_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('vouchers', ['code', 'restaurant_id'], {
        unique: true,
        name: 'idx_vouchers_code_restaurant'
    });
    await queryInterface.addIndex('vouchers', ['promotion_id'], { name: 'idx_vouchers_promotion' });

    await queryInterface.createTable('voucher_tiers', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        voucher_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'vouchers',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        min_spend_cents: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        discount_percent: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        max_discount_cents: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('voucher_tiers', ['voucher_id', 'min_spend_cents'], {
        name: 'idx_voucher_tiers_voucher_min_spend'
    });

    await queryInterface.createTable('customer_vouchers', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        voucher_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'vouchers',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        promotion_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'promotions',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'restaurants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        customer_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'customers',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        code: {
            type: DataTypes.STRING(120),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM(...CUSTOMER_VOUCHER_STATUSES),
            allowNull: false,
            defaultValue: 'AVAILABLE'
        },
        claim_channel: {
            type: DataTypes.STRING(40),
            allowNull: true
        },
        claimed_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        expires_at: {
            allowNull: true,
            type: DataTypes.DATE
        },
        redeemed_at: {
            allowNull: true,
            type: DataTypes.DATE
        },
        metadata: {
            allowNull: true,
            type: DataTypes.JSON
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('customer_vouchers', ['voucher_id', 'customer_id'], {
        unique: true,
        name: 'idx_customer_vouchers_unique'
    });
    await queryInterface.addIndex('customer_vouchers', ['customer_id', 'status'], {
        name: 'idx_customer_vouchers_customer_status'
    });
    await queryInterface.addIndex('customer_vouchers', ['restaurant_id'], {
        name: 'idx_customer_vouchers_restaurant'
    });

    await queryInterface.addColumn('orders', 'customer_voucher_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'customer_vouchers',
            key: 'id'
        },
        onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('orders', 'promotion_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'promotions',
            key: 'id'
        },
        onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('orders', 'voucher_discount_cents', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });

    await queryInterface.addColumn('orders', 'loyalty_discount_cents', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });

    await queryInterface.addColumn('orders', 'loyalty_points_redeemed', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });
};

export const down = async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'loyalty_points_redeemed');
    await queryInterface.removeColumn('orders', 'loyalty_discount_cents');
    await queryInterface.removeColumn('orders', 'voucher_discount_cents');
    await queryInterface.removeColumn('orders', 'promotion_id');
    await queryInterface.removeColumn('orders', 'customer_voucher_id');

    await queryInterface.removeIndex('customer_vouchers', 'idx_customer_vouchers_restaurant');
    await queryInterface.removeIndex('customer_vouchers', 'idx_customer_vouchers_customer_status');
    await queryInterface.removeIndex('customer_vouchers', 'idx_customer_vouchers_unique');
    await queryInterface.dropTable('customer_vouchers');

    await queryInterface.removeIndex('voucher_tiers', 'idx_voucher_tiers_voucher_min_spend');
    await queryInterface.dropTable('voucher_tiers');

    await queryInterface.removeIndex('vouchers', 'idx_vouchers_promotion');
    await queryInterface.removeIndex('vouchers', 'idx_vouchers_code_restaurant');
    await queryInterface.dropTable('vouchers');

    await queryInterface.dropTable('promotions');
};
