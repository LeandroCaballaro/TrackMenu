import { Router } from 'express';
import { login, register, getCurrentUser, aceptarInvitacion, fundarOrganizacion } from '../controllers/auth.controller.js';
import { requireAuth, requireSesion } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', requireAuth, getCurrentUser);
// Sólo pide sesión: quien la usa todavía no pertenece a una organización.
router.post('/aceptar-invitacion', requireSesion, aceptarInvitacion);
router.post('/fundar-organizacion', requireSesion, fundarOrganizacion);

export default router;
