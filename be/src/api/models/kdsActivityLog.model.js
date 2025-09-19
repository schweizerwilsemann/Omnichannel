import { DataTypes } from 'sequelize';
import { TABLES, KDS_ACTIONS, ACTOR_TYPE } from '../utils/common.js';

const kdsActivityLogModel = (sequelize) =>
    sequelize.define(
        TABLES.KDS_ACTIVITY_LOGS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            kdsTicketId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'kds_ticket_id'
            },
            actor: {
                type: DataTypes.ENUM(...Object.values(ACTOR_TYPE)),
                allowNull: false
            },
            actorId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'actor_id'
            },
            action: {
                type: DataTypes.ENUM(...Object.values(KDS_ACTIONS)),
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

export default kdsActivityLogModel;
