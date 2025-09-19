import { DataTypes } from 'sequelize';
import { TABLES, TABLE_STATUS } from '../utils/common.js';

const restaurantTableModel = (sequelize) =>
    sequelize.define(
        TABLES.RESTAURANT_TABLES,
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
            name: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            qrSlug: {
                type: DataTypes.STRING(120),
                allowNull: false,
                unique: true,
                field: 'qr_slug'
            },
            capacity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 2
            },
            status: {
                type: DataTypes.ENUM(...Object.values(TABLE_STATUS)),
                allowNull: false,
                defaultValue: TABLE_STATUS.AVAILABLE
            }
        },
        {
            underscored: true
        }
    );

export default restaurantTableModel;
