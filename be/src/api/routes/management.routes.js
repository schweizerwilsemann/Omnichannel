import { Router } from 'express';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    menuItemCreateSchema,
    menuItemUpdateSchema,
    menuComboCreateSchema,
    menuComboUpdateSchema,
    customerMembershipCreateSchema,
    customerMembershipUpdateSchema,
    tableCreateSchema,
    tableUpdateSchema,
    promotionCreateSchema,
    promotionUpdateSchema
} from '../validations/management.validation.js';
import {
    getMenuCatalogController,
    createMenuItemController,
    updateMenuItemController,
    createMenuComboController,
    updateMenuComboController,
    listCustomersController,
    createCustomerMembershipController,
    updateCustomerMembershipController,
    listTablesController,
    createTableController,
    updateTableController,
    listPromotionsController,
    getPromotionController,
    createPromotionController,
    updatePromotionController,
    dispatchPromotionEmailsController
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
router.post('/menu/combos', authenticateAdmin(), validationMiddleware(menuComboCreateSchema), createMenuComboController);
router.patch(
    '/menu/combos/:comboId',
    authenticateAdmin(),
    validationMiddleware(menuComboUpdateSchema),
    updateMenuComboController
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

router.get('/promotions', authenticateAdmin(), listPromotionsController);
router.get('/promotions/:promotionId', authenticateAdmin(), getPromotionController);
router.post('/promotions', authenticateAdmin(), validationMiddleware(promotionCreateSchema), createPromotionController);
router.patch(
    '/promotions/:promotionId',
    authenticateAdmin(),
    validationMiddleware(promotionUpdateSchema),
    updatePromotionController
);
router.post('/promotions/:promotionId/dispatch', authenticateAdmin(), dispatchPromotionEmailsController);

export default router;
