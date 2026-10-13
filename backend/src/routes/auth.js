import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one } from '../db.js';
import { HttpError, publicUser, requireAuth, signToken } from '../auth.js';

const router = Router();

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

router.post('/register', async (req, res) => {
  const body = req.body || {};
  const full_name = clean(body.full_name);
  const email = clean(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const cedula = clean(body.cedula);
  const phone = clean(body.phone);

  if (!full_name || !email || !cedula || !phone) throw new HttpError(400, 'Completa todos los campos obligatorios');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Correo inválido');
  if (password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (!body.accept_terms) throw new HttpError(400, 'Debes aceptar las políticas de Árbol');

  const user = await one(
    `INSERT INTO users (full_name, email, password_hash, cedula, phone, medical_notes, accepted_terms_at)
     VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
    [full_name, email, await bcrypt.hash(password, 10), cedula, phone, clean(body.medical_notes) || null],
  );
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = req.body?.password || '';
  const user = await one('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) throw new HttpError(401, 'Usuario no encontrado');
  res.json({ user: publicUser(user) });
});

export default router;
