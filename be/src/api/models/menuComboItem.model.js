import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuComboItemModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_COMBO_ITEMS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            comboItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'combo_item_id'
            },
            menuItemId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'menu_item_id'
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            }
        },
        {
            underscored: true
        }
    );

export default menuComboItemModel;

