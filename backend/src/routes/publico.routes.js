import { Router } from 'express';
import { cartaPublica, reservaPorCodigo, reservarPublico } from '../controllers/publico.controller.js';

const router = Router();

// Sin requireAuth a propósito: es la carta que abre el cliente desde el QR.
router.get('/carta/:organizacionId', cartaPublica);
router.get('/reserva/:codigo', reservaPorCodigo);
router.post('/reservas/:organizacionId', reservarPublico);

export default router;
