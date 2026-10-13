import bcrypt from 'bcryptjs';
import { query, one } from './db.js';

const PLANS = [
  ['semi_4', 'Semi-personalizado · 4 sesiones', 'semi', 4, 160000],
  ['semi_8', 'Semi-personalizado · 8 sesiones', 'semi', 8, 280000],
  ['semi_12', 'Semi-personalizado · 12 sesiones', 'semi', 12, 390000],
  ['personal_4', 'Personalizado 1:1 · 4 sesiones', 'personal', 4, 300000],
  ['personal_8', 'Personalizado 1:1 · 8 sesiones', 'personal', 8, 580000],
  ['personal_12', 'Personalizado 1:1 · 12 sesiones', 'personal', 12, 810000],
];

const SEMI_HOURS = ['06:00', '07:00', '08:00', '17:00', '18:00', '19:00'];
const PERSONAL_HOURS = ['09:00', '10:00', '11:00', '15:00', '16:00'];
const SATURDAY_SEMI = ['08:00', '09:00'];

export async function seed() {
  for (const [code, name, type, sessions, price] of PLANS) {
    await query(
      `INSERT INTO plans (code, name, class_type, sessions, price_regular)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`,
      [code, name, type, sessions, price],
    );
  }

  const { n } = await one('SELECT count(*)::int AS n FROM schedule_templates');
  if (n === 0) {
    const rows = [];
    for (let weekday = 1; weekday <= 5; weekday++) {
      SEMI_HOURS.forEach((h) => rows.push([weekday, h, 'semi', 6]));
      PERSONAL_HOURS.forEach((h) => rows.push([weekday, h, 'personal', 1]));
    }
    SATURDAY_SEMI.forEach((h) => rows.push([6, h, 'semi', 6]));
    for (const [weekday, time, type, capacity] of rows) {
      await query(
        `INSERT INTO schedule_templates (weekday, start_time, class_type, capacity) VALUES ($1, $2, $3, $4)`,
        [weekday, time, type, capacity],
      );
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  const email = (process.env.ADMIN_EMAIL || (isProd ? '' : 'admin@arbol.co')).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (isProd ? '' : 'arbol123');
  if (email && password) {
    const existing = await one('SELECT id FROM users WHERE email = $1', [email]);
    if (!existing) {
      await query(
        `INSERT INTO users (full_name, email, password_hash, role, accepted_terms_at)
         VALUES ('Administrador Árbol', $1, $2, 'admin', now())`,
        [email, await bcrypt.hash(password, 10)],
      );
      console.log(`[seed] Admin creado: ${email}`);
    }
  }
}
