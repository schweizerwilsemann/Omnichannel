import { DataTypes } from 'sequelize';

const MENU_ITEMS_TABLE = 'menu_items';
const MENU_COMBO_ITEMS_TABLE = 'menu_combo_items';

const tableExists = async (queryInterface, tableName) => {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
        typeof table === 'string' ? table : table.tableName || table.name
    );
    return normalizedTables.includes(tableName);
};

export const up = async (queryInterface) => {
    const itemColumns = await queryInterface.describeTable(MENU_ITEMS_TABLE);
    if (!itemColumns.is_combo) {
        await queryInterface.addColumn(MENU_ITEMS_TABLE, 'is_combo', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        await queryInterface.addIndex(MENU_ITEMS_TABLE, ['is_combo']);
    }

    if (!(await tableExists(queryInterface, MENU_COMBO_ITEMS_TABLE))) {
        await queryInterface.createTable(MENU_COMBO_ITEMS_TABLE, {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            combo_item_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: MENU_ITEMS_TABLE,
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            menu_item_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: MENU_ITEMS_TABLE,
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
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

        await queryInterface.addIndex(MENU_COMBO_ITEMS_TABLE, ['combo_item_id']);
        await queryInterface.addIndex(MENU_COMBO_ITEMS_TABLE, ['menu_item_id']);
        await queryInterface.addConstraint(MENU_COMBO_ITEMS_TABLE, {
            type: 'unique',
            fields: ['combo_item_id', 'menu_item_id'],
            name: 'menu_combo_items_combo_item_id_menu_item_id_key'
        });
    }
};

export const down = async (queryInterface) => {
    if (await tableExists(queryInterface, MENU_COMBO_ITEMS_TABLE)) {
        await queryInterface.dropTable(MENU_COMBO_ITEMS_TABLE);
    }

    try {
        const itemColumns = await queryInterface.describeTable(MENU_ITEMS_TABLE);
        if (itemColumns.is_combo) {
            await queryInterface.removeIndex(MENU_ITEMS_TABLE, ['is_combo']).catch(() => {});
            await queryInterface.removeColumn(MENU_ITEMS_TABLE, 'is_combo');
        }
    } catch (error) {
        // ignore when table no longer exists
    }
};
