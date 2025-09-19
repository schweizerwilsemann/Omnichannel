import { Router } from 'express';
import { uploadAsset, listAssets, downloadAsset, deleteAsset } from '../controllers/asset.controller.js';

const router = Router();

router.get('/', listAssets);
router.post('/', ...uploadAsset);
router.get('/:fileName', downloadAsset);
router.delete('/:fileName', deleteAsset);

export default router;
