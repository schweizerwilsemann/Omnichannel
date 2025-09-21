import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('menu_items', 'image_url', {
        type: DataTypes.STRING(500),
        allowNull: true
    });
};

export const down = async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('menu_items', 'image_url');
};
