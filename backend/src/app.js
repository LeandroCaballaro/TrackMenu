import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Al publicar hay más de un origen (local y el dominio del frontend
// desplegado): FRONTEND_URL acepta varios separados por coma.
const origenes = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origen, cb) => cb(null, !origen || origenes.includes(origen)),
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api', apiRouter);

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
