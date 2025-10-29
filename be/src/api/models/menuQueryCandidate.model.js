import { DataTypes } from 'sequelize';
import { TABLES } from '../utils/common.js';

const menuQueryCandidateModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_QUERY_CANDIDATES,
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
            menuItemId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'menu_item_id'
            },
            rank: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            recallScore: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true,
                field: 'recall_score'
            },
            rerankScore: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true,
                field: 'rerank_score'
            },
            finalScore: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true,
                field: 'final_score'
            },
            reasons: {
                type: DataTypes.JSON,
                allowNull: true
            },
            selected: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

export default menuQueryCandidateModel;
