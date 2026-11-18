import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

const app = express();
app.set('trust proxy', 1);

// Al publicar hay más de un origen (local y el dominio del frontend
// desplegado): FRONTEND_URL acepta varios separados por coma y se suma
// automáticamente RENDER_EXTERNAL_URL cuando corre en Render.
const normalizarOrigen = (url) => String(url || '').trim().replace(/\/+$/, '');
const origenes = [
  ...(process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
  process.env.RENDER_EXTERNAL_URL || '',
]
  .map(normalizarOrigen)
  .filter(Boolean);

app.use(cors({
  origin: (origen, cb) => cb(null, !origen || origenes.includes(normalizarOrigen(origen))),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rutas API
app.use('/api', apiRouter);
app.use('/api', notFoundHandler);

// En producción (Render) Express sirve también el build del frontend Vue
// para que /api y las vistas SPA compartan el mismo dominio sin problemas de CORS.
if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(frontendIndexPath);
  });
}

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
