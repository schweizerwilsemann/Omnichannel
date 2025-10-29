import { DataTypes } from 'sequelize';

const LOG_TABLE = 'menu_query_logs';
const CANDIDATE_TABLE = 'menu_query_candidates';
const CLARIFICATION_TABLE = 'menu_query_clarifications';
const RESOLUTION_STATUSES = ['AUTO', 'NEEDS_CLARIFICATION', 'CLARIFIED', 'FALLBACK'];

const tableExists = async (queryInterface, tableName) => {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
        typeof table === 'string' ? table : table.tableName || table.name
    );
    return normalizedTables.includes(tableName);
};

export const up = async (queryInterface) => {
    if (!(await tableExists(queryInterface, LOG_TABLE))) {
        await queryInterface.createTable(LOG_TABLE, {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            restaurant_id: {
                type: DataTypes.UUID,
                allowNull: false
            },
            guest_session_id: {
                type: DataTypes.UUID,
                allowNull: true
            },
            customer_id: {
                type: DataTypes.UUID,
                allowNull: true
            },
            raw_query: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            normalized_query: {
                type: DataTypes.STRING(255),
                allowNull: false
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
            ambiguity_score: {
                type: DataTypes.DECIMAL(6, 3),
                allowNull: false,
                defaultValue: 0
            },
            top_score: {
                type: DataTypes.DECIMAL(8, 3),
                allowNull: true
            },
            second_score: {
                type: DataTypes.DECIMAL(8, 3),
                allowNull: true
            },
            total_candidates: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 6
            },
            resolution_status: {
                type: DataTypes.ENUM(...RESOLUTION_STATUSES),
                allowNull: false,
                defaultValue: 'AUTO'
            },
            resolved_item_id: {
                type: DataTypes.UUID,
                allowNull: true
            },
            fallback_reason: {
                type: DataTypes.STRING(120),
                allowNull: true
            },
            triggered_clarification: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

        await queryInterface.addIndex(LOG_TABLE, ['restaurant_id', 'created_at']);
        await queryInterface.addIndex(LOG_TABLE, ['guest_session_id']);
        await queryInterface.addIndex(LOG_TABLE, ['resolution_status']);
    }

    if (!(await tableExists(queryInterface, CANDIDATE_TABLE))) {
        await queryInterface.createTable(CANDIDATE_TABLE, {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            query_log_id: {
                type: DataTypes.UUID,
                allowNull: false
            },
            menu_item_id: {
                type: DataTypes.UUID,
                allowNull: true
            },
            rank: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            recall_score: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            },
            rerank_score: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
            },
            final_score: {
                type: DataTypes.DECIMAL(10, 6),
                allowNull: true
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

        await queryInterface.addIndex(CANDIDATE_TABLE, ['query_log_id']);
        await queryInterface.addIndex(CANDIDATE_TABLE, ['menu_item_id']);
    }

    if (!(await tableExists(queryInterface, CLARIFICATION_TABLE))) {
        await queryInterface.createTable(CLARIFICATION_TABLE, {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            query_log_id: {
                type: DataTypes.UUID,
                allowNull: false
            },
            question_text: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            user_reply: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            resolved_intent: {
                type: DataTypes.STRING(120),
                allowNull: true
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            },
            resolved_at: {
                type: DataTypes.DATE,
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

        await queryInterface.addIndex(CLARIFICATION_TABLE, ['query_log_id']);
        await queryInterface.addIndex(CLARIFICATION_TABLE, ['resolved_at']);
    }
};

export const down = async (queryInterface) => {
    if (await tableExists(queryInterface, CLARIFICATION_TABLE)) {
        await queryInterface.dropTable(CLARIFICATION_TABLE);
    }
    if (await tableExists(queryInterface, CANDIDATE_TABLE)) {
        await queryInterface.dropTable(CANDIDATE_TABLE);
    }
    if (await tableExists(queryInterface, LOG_TABLE)) {
        await queryInterface.dropTable(LOG_TABLE);
    }
};

