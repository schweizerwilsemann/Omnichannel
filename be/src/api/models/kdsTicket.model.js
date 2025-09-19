import { DataTypes } from 'sequelize';
import { TABLES, KDS_TICKET_STATUS } from '../utils/common.js';

const kdsTicketModel = (sequelize) =>
    sequelize.define(
        TABLES.KDS_TICKETS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            orderId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'order_id'
            },
            sequenceNo: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'sequence_no'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(KDS_TICKET_STATUS)),
                allowNull: false,
                defaultValue: KDS_TICKET_STATUS.QUEUED
            },
            station: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            bumpedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'bumped_at'
            }
        },
        {
            underscored: true
        }
    );

export default kdsTicketModel;
