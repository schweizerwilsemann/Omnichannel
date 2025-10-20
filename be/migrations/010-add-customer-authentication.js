import { DataTypes } from 'sequelize';

const CUSTOMER_TABLE = 'customers';
const CHALLENGE_TABLE = 'customer_auth_challenges';
const MEMBERSHIP_TABLE = 'restaurant_customers';

const ensureCustomerColumns = async (queryInterface) => {
    const definition = await queryInterface.describeTable(CUSTOMER_TABLE);
    if (!definition.authenticator_secret) {
        await queryInterface.addColumn(CUSTOMER_TABLE, 'authenticator_secret', {
            type: DataTypes.STRING(128),
            allowNull: true,
            defaultValue: null
        });
    }
    if (!definition.authenticator_enabled) {
        await queryInterface.addColumn(CUSTOMER_TABLE, 'authenticator_enabled', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }
    if (!definition.authenticator_enabled_at) {
        await queryInterface.addColumn(CUSTOMER_TABLE, 'authenticator_enabled_at', {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
};

const ensureMembershipColumns = async (queryInterface) => {
    const definition = await queryInterface.describeTable(MEMBERSHIP_TABLE);
    if (!definition.pin_hash) {
        await queryInterface.addColumn(MEMBERSHIP_TABLE, 'pin_hash', {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null
        });
    }
    if (!definition.pin_set_at) {
        await queryInterface.addColumn(MEMBERSHIP_TABLE, 'pin_set_at', {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
};

export const up = async (queryInterface) => {
    await ensureCustomerColumns(queryInterface);
    await ensureMembershipColumns(queryInterface);

    const tables = await queryInterface.showAllTables();
    if (tables.includes(CHALLENGE_TABLE)) {
        const definition = await queryInterface.describeTable(CHALLENGE_TABLE);
        if (definition.method && !definition.challenge_type) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'challenge_type', {
                type: DataTypes.STRING(32),
                allowNull: false,
                defaultValue: 'TOTP'
            });
            await queryInterface.removeColumn(CHALLENGE_TABLE, 'method');
        } else if (!definition.challenge_type) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'challenge_type', {
                type: DataTypes.STRING(32),
                allowNull: false,
                defaultValue: 'TOTP'
            });
        }
        if (!definition.expires_at) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'expires_at', {
                type: DataTypes.DATE,
                allowNull: false
            });
        }
        if (!definition.consumed_at) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'consumed_at', {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            });
        }
        if (!definition.attempts) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'attempts', {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            });
        }
        if (!definition.metadata) {
            await queryInterface.addColumn(CHALLENGE_TABLE, 'metadata', {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null
            });
        }
        return;
    }

    await queryInterface.createTable(CHALLENGE_TABLE, {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        customer_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        challenge_type: {
            type: DataTypes.STRING(32),
            allowNull: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        consumed_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        },
        attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
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

    await queryInterface.addIndex(CHALLENGE_TABLE, ['customer_id', 'restaurant_id']);
    await queryInterface.addIndex(CHALLENGE_TABLE, ['expires_at']);
};

export const down = async (queryInterface) => {
    const membershipDefinition = await queryInterface.describeTable(MEMBERSHIP_TABLE);
    if (membershipDefinition.pin_set_at) {
        await queryInterface.removeColumn(MEMBERSHIP_TABLE, 'pin_set_at');
    }
    if (membershipDefinition.pin_hash) {
        await queryInterface.removeColumn(MEMBERSHIP_TABLE, 'pin_hash');
    }

    const customerDefinition = await queryInterface.describeTable(CUSTOMER_TABLE);
    if (customerDefinition.authenticator_enabled_at) {
        await queryInterface.removeColumn(CUSTOMER_TABLE, 'authenticator_enabled_at');
    }
    if (customerDefinition.authenticator_enabled) {
        await queryInterface.removeColumn(CUSTOMER_TABLE, 'authenticator_enabled');
    }
    if (customerDefinition.authenticator_secret) {
        await queryInterface.removeColumn(CUSTOMER_TABLE, 'authenticator_secret');
    }

    const tables = await queryInterface.showAllTables();
    if (tables.includes(CHALLENGE_TABLE)) {
        await queryInterface.dropTable(CHALLENGE_TABLE);
    }
};
