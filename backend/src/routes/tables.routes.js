import { Router } from 'express';
import {
  getTables,
  getTableById,
  releaseTable,
  occupyTable,
} from '../controllers/tables.controller.js';

const router = Router();

router.get('/', getTables);
router.get('/:number', getTableById);
router.post('/:number/liberar', releaseTable);
router.post('/:number/ocupar', occupyTable);

export default router;
