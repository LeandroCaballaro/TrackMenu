import { Router } from 'express';
import { cartaPublica } from '../controllers/publico.controller.js';

const router = Router();

// Sin requireAuth a propósito: es la carta que abre el cliente desde el QR.
router.get('/carta/:organizacionId', cartaPublica);

export default router;
