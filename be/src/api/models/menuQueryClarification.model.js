import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuQueryClarificationModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_QUERY_CLARIFICATIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            queryLogId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'query_log_id'
            },
            questionText: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'question_text'
            },
            userReply: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'user_reply'
            },
            resolvedIntent: {
                type: DataTypes.STRING(120),
                allowNull: true,
                field: 'resolved_intent'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            },
            resolvedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'resolved_at'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'created_at'
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'updated_at'
            }
        },
        {
            underscored: true
        }
    );

export default menuQueryClarificationModel;
