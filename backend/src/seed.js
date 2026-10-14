import bcrypt from 'bcryptjs';
import { query, one } from './db.js';

// [code, name, class_type, sessions, price_regular, duration_months]
const PLANS = [
  ['founder_annual', 'Membresía Founder · Anual', 'membership', 0, 0, 12],
  ['semi_8', 'FLEX · 8 sesiones', 'semi', 8, 280000, 1],
  ['semi_12', 'FLEX · 12 sesiones', 'semi', 12, 390000, 1],
  ['personal_4', 'Personalizado 1:1 · 4 sesiones', 'personal', 4, 300000, 1],
  ['personal_8', 'Personalizado 1:1 · 8 sesiones', 'personal', 8, 580000, 1],
  ['personal_12', 'Personalizado 1:1 · 12 sesiones', 'personal', 12, 810000, 1],
];

export async function seed() {
  for (const [code, name, type, sessions, price, months] of PLANS) {
    await query(
      `INSERT INTO plans (code, name, class_type, sessions, price_regular, duration_months)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING`,
      [code, name, type, sessions, price, months],
    );
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
