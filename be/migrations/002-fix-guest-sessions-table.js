import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
    // Add missing columns to guest_sessions table
    await queryInterface.addColumn('guest_sessions', 'customer_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'customers',
            key: 'id'
        }
    });

    await queryInterface.addColumn('guest_sessions', 'membership_status', {
        type: DataTypes.ENUM('GUEST', 'MEMBER'),
        allowNull: false,
        defaultValue: 'GUEST'
    });

    await queryInterface.addColumn('guest_sessions', 'session_token', {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
    });

    await queryInterface.addColumn('guest_sessions', 'started_at', {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    });

    await queryInterface.addColumn('guest_sessions', 'closed_at', {
        type: DataTypes.DATE,
        allowNull: true
    });

    await queryInterface.addColumn('guest_sessions', 'customer_meta', {
        type: DataTypes.JSON,
        allowNull: true
    });
};

export const down = async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('guest_sessions', 'customer_id');
    await queryInterface.removeColumn('guest_sessions', 'membership_status');
    await queryInterface.removeColumn('guest_sessions', 'session_token');
    await queryInterface.removeColumn('guest_sessions', 'started_at');
    await queryInterface.removeColumn('guest_sessions', 'closed_at');
    await queryInterface.removeColumn('guest_sessions', 'customer_meta');
};
