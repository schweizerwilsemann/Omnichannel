import { DataTypes } from 'sequelize';
import { TABLES, SECURITY_EVENT_TYPES } from '../utils/common.js';

const securityEventModel = (sequelize) =>
    sequelize.define(
        TABLES.SECURITY_EVENTS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'user_id'
            },
            type: {
                type: DataTypes.ENUM(...Object.values(SECURITY_EVENT_TYPES)),
                allowNull: false
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        },
        {
            underscored: true,
            timestamps: true,
            updatedAt: false
        }
    );

export default securityEventModel;
