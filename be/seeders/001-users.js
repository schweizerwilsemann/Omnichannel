import models from '../src/api/models/index.js';
import { USER_ROLES, USER_STATUS } from '../src/api/utils/common.js';

export const up = async () => {
    const { User, UserCredential } = models;
    
    // Create restaurant owner
    const owner = await User.create({
        firstName: 'John',
        lastName: 'Smith',
        email: 'owner@restaurant.com',
        phoneNumber: '+1234567890',
        status: USER_STATUS.ACTIVE,
        role: USER_ROLES.OWNER
    });

    // Create owner credentials
    await UserCredential.create({
        userId: owner.id,
        passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: password
    });

    // Create restaurant manager
    const manager = await User.create({
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'manager@restaurant.com',
        phoneNumber: '+1234567891',
        status: USER_STATUS.ACTIVE,
        role: USER_ROLES.MANAGER
    });

    // Create manager credentials
    await UserCredential.create({
        userId: manager.id,
        passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: password
    });

    console.log('✅ Users seeded successfully');
};

export const down = async () => {
    const { User, UserCredential } = models;
    
    await UserCredential.destroy({ where: {} });
    await User.destroy({ where: {} });
    
    console.log('✅ Users unseeded successfully');
};
