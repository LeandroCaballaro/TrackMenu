import { Router } from 'express';
import productsRoutes from './products.routes.js';
import tablesRoutes from './tables.routes.js';
import ordersRoutes from './orders.routes.js';
import authRoutes from './auth.routes.js';

const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/products', productsRoutes);
apiRouter.use('/tables', tablesRoutes);
apiRouter.use('/orders', ordersRoutes);
apiRouter.use('/auth', authRoutes);

export default apiRouter;
