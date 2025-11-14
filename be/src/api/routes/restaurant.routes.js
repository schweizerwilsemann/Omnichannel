import { Router } from 'express';
import {
    listRestaurantsController,
    getRestaurantController,
    createRestaurantController,
    updateRestaurantController,
    deleteRestaurantController,
    getRestaurantsByOwnerController,
    updateRestaurantStatusController
} from '../controllers/restaurant.controller.js';
import authenticateAdmin from '../middlewares/auth.middleware.js';
import validationMiddleware from '../middlewares/validation.middleware.js';
import {
    restaurantCreateSchema,
    restaurantUpdateSchema,
    restaurantStatusUpdateSchema
} from '../validations/restaurant.validation.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateAdmin());

// Restaurant CRUD routes
router.get('/', listRestaurantsController);
router.get('/:restaurantId', getRestaurantController);
router.post('/', validationMiddleware(restaurantCreateSchema), createRestaurantController);
router.put('/:restaurantId', validationMiddleware(restaurantUpdateSchema), updateRestaurantController);
router.delete('/:restaurantId', deleteRestaurantController);

// Additional restaurant routes
router.get('/owner/:ownerId', getRestaurantsByOwnerController);
router.patch('/:restaurantId/status', validationMiddleware(restaurantStatusUpdateSchema), updateRestaurantStatusController);

export default router;
