import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('restaurant_customers', 'discount_balance_cents', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });

    await queryInterface.addColumn('restaurant_customers', 'last_claimed_at', {
        type: DataTypes.DATE,
        allowNull: true
    });
};

export const down = async (queryInterface) => {
    await queryInterface.removeColumn('restaurant_customers', 'last_claimed_at');
    await queryInterface.removeColumn('restaurant_customers', 'discount_balance_cents');
};