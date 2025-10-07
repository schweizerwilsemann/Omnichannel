import { DataTypes } from 'sequelize';

export const up = async (queryInterface) => {
    await queryInterface.addColumn('orders', 'discount_applied_cents', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });

    await queryInterface.addColumn('orders', 'earned_loyalty_points', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });
};

export const down = async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'earned_loyalty_points');
    await queryInterface.removeColumn('orders', 'discount_applied_cents');
};