import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    menuItemCreateSchema,
    menuItemUpdateSchema,
    customerMembershipCreateSchema,
    customerMembershipUpdateSchema,
    tableCreateSchema,
    tableUpdateSchema
} from '../validations/management.validation.js';
import {
    getMenuCatalogController,
    createMenuItemController,
    updateMenuItemController,
    listCustomersController,
    createCustomerMembershipController,
    updateCustomerMembershipController,
    listTablesController,
    createTableController,
    updateTableController
} from '../controllers/management.controller.js';

const router = Router();

router.get('/menu', authenticateAdmin(), getMenuCatalogController);
router.post('/menu/items', authenticateAdmin(), validationMiddleware(menuItemCreateSchema), createMenuItemController);
router.patch(
    '/menu/items/:menuItemId',
    authenticateAdmin(),
    validationMiddleware(menuItemUpdateSchema),
    updateMenuItemController
);

router.get('/customers', authenticateAdmin(), listCustomersController);
router.post(
    '/customers',
    authenticateAdmin(),
    validationMiddleware(customerMembershipCreateSchema),
    createCustomerMembershipController
);
router.patch(
    '/customers/:membershipId',
    authenticateAdmin(),
    validationMiddleware(customerMembershipUpdateSchema),
    updateCustomerMembershipController
);

router.get('/tables', authenticateAdmin(), listTablesController);
router.post('/tables', authenticateAdmin(), validationMiddleware(tableCreateSchema), createTableController);
router.patch(
    '/tables/:tableId',
    authenticateAdmin(),
    validationMiddleware(tableUpdateSchema),
    updateTableController
);

export default router;
