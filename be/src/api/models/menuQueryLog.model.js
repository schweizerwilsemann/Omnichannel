import { DataTypes } from 'sequelize';
import { TABLES, MENU_QUERY_RESOLUTION_STATUS } from '../utils/common.js';

const menuQueryLogModel = (sequelize) =>
    sequelize.define(
        TABLES.MENU_QUERY_LOGS,
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
            guestSessionId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'guest_session_id'
            },
            customerId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'customer_id'
            },
            rawQuery: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'raw_query'
            },
            normalizedQuery: {
                type: DataTypes.STRING(255),
                allowNull: false,
                field: 'normalized_query'
            },
            tokens: {
                type: DataTypes.JSON,
                allowNull: true
            },
            intents: {
                type: DataTypes.JSON,
                allowNull: true
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            },
            ambiguityScore: {
                type: DataTypes.DECIMAL(6, 3),
                allowNull: false,
                defaultValue: 0,
                field: 'ambiguity_score'
            },
            topScore: {
                type: DataTypes.DECIMAL(8, 3),
                allowNull: true,
                field: 'top_score'
            },
            secondScore: {
                type: DataTypes.DECIMAL(8, 3),
                allowNull: true,
                field: 'second_score'
            },
            totalCandidates: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'total_candidates'
            },
            limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 6
            },
            resolutionStatus: {
                type: DataTypes.ENUM(...Object.values(MENU_QUERY_RESOLUTION_STATUS)),
                allowNull: false,
                defaultValue: MENU_QUERY_RESOLUTION_STATUS.AUTO,
                field: 'resolution_status'
            },
            resolvedItemId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'resolved_item_id'
            },
            fallbackReason: {
                type: DataTypes.STRING(120),
                allowNull: true,
                field: 'fallback_reason'
            },
            triggeredClarification: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'triggered_clarification'
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

export default menuQueryLogModel;
