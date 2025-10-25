import { DataTypes } from 'sequelize';

const TABLE_NAME = 'menu_recommendation_history';

export const up = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => (typeof table === 'string' ? table : table.tableName || table.name));

    if (normalizedTables.includes(TABLE_NAME)) {
        return;
    }

    await queryInterface.createTable(TABLE_NAME, {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        base_item_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        recommended_item_id: {
            type: DataTypes.UUID,
            allowNull: false
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
        attach_rate: {
            type: DataTypes.DECIMAL(10, 6),
            allowNull: false,
            defaultValue: 0
        },
        support_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        run_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        generated_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex(TABLE_NAME, ['restaurant_id', 'base_item_id', 'recommended_item_id'], {
        name: 'rec_hist_rest_base_comp_idx'
    });
    await queryInterface.addIndex(TABLE_NAME, ['run_id'], {
        name: 'rec_hist_run_idx'
    });
    await queryInterface.addIndex(TABLE_NAME, ['generated_at'], {
        name: 'rec_hist_generated_idx'
    });
};

export const down = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => (typeof table === 'string' ? table : table.tableName || table.name));

    if (!normalizedTables.includes(TABLE_NAME)) {
        return;
    }

    await queryInterface.dropTable(TABLE_NAME);
};
