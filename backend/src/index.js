import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { seed } from './seed.js';
import { ensureSlots } from './booking.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import clientRoutes from './routes/client.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origen no permitido: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', clientRoutes);

app.use((err, _req, res, _next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos (correo o cédula)' });
  if (err.code === '23514' || err.code === '22P02') return res.status(400).json({ error: 'Datos inválidos' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : err.message });
});

await initDb();
await seed();
await ensureSlots();

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`[api] Árbol API escuchando en http://localhost:${port}`));
