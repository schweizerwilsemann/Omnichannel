import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
    // Add customer_id column to orders table
    await queryInterface.addColumn('orders', 'customer_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'customers',
            key: 'id'
        }
    });
};

export const down = async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('orders', 'customer_id');
};
