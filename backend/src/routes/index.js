import { Router } from 'express';
import productsRoutes from './products.routes.js';
import productosRoutes from './productos.routes.js';
import tablesRoutes from './tables.routes.js';
import ordersRoutes from './orders.routes.js';
import authRoutes from './auth.routes.js';
import miembrosRoutes, { invitacionesRouter } from './miembros.routes.js';
import adminRoutes from './admin.routes.js';

const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/products', productsRoutes);
apiRouter.use('/productos', productosRoutes);
apiRouter.use('/tables', tablesRoutes);
apiRouter.use('/orders', ordersRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/miembros', miembrosRoutes);
apiRouter.use('/invitaciones', invitacionesRouter);
apiRouter.use('/admin', adminRoutes);

export default apiRouter;
