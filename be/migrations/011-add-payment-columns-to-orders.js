import { DataTypes } from 'sequelize';

const PAYMENT_STATUS_ENUM = ['PENDING', 'SUCCEEDED', 'FAILED'];
const PAYMENT_METHOD_ENUM = ['CARD', 'CASH', 'NONE'];

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
    const columns = await queryInterface.describeTable(table);
    if (!columns[column]) {
        await queryInterface.addColumn(table, column, definition);
    }
};

export const up = async (queryInterface) => {
    await addColumnIfMissing(queryInterface, 'orders', 'payment_method', {
        type: DataTypes.ENUM(...PAYMENT_METHOD_ENUM),
        allowNull: false,
        defaultValue: 'CARD'
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_status', {
        type: DataTypes.ENUM(...PAYMENT_STATUS_ENUM),
        allowNull: false,
        defaultValue: 'SUCCEEDED'
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_provider', {
        type: DataTypes.STRING(40),
        allowNull: true
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_intent_id', {
        type: DataTypes.STRING(120),
        allowNull: true
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_reference', {
        type: DataTypes.STRING(120),
        allowNull: true
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_metadata', {
        type: DataTypes.JSON,
        allowNull: true
    });

    await addColumnIfMissing(queryInterface, 'orders', 'payment_confirmed_at', {
        type: DataTypes.DATE,
        allowNull: true
    });
};

export const down = async (queryInterface) => {
    const columns = await queryInterface.describeTable('orders');

    if (columns.payment_confirmed_at) {
        await queryInterface.removeColumn('orders', 'payment_confirmed_at');
    }
    if (columns.payment_metadata) {
        await queryInterface.removeColumn('orders', 'payment_metadata');
    }
    if (columns.payment_reference) {
        await queryInterface.removeColumn('orders', 'payment_reference');
    }
    if (columns.payment_intent_id) {
        await queryInterface.removeColumn('orders', 'payment_intent_id');
    }
    if (columns.payment_provider) {
        await queryInterface.removeColumn('orders', 'payment_provider');
    }
    if (columns.payment_status) {
        await queryInterface.removeColumn('orders', 'payment_status');
    }
    if (columns.payment_method) {
        await queryInterface.removeColumn('orders', 'payment_method');
    }

    // Cleanup ENUM type in dialects that persist it (e.g. PostgreSQL)
    if (queryInterface.sequelize?.getDialect() === 'postgres') {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_method";');
    }
};
