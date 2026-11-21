import { HttpError } from './auth.js';

export const MEASUREMENT_FIELDS = {
  weight_kg: [20, 300],
  body_fat_pct: [1, 70],
  muscle_pct: [5, 80],
  waist_cm: [30, 250],
  hip_cm: [30, 250],
  chest_cm: [30, 250],
  arm_cm: [10, 100],
  thigh_cm: [20, 150],
};

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const toNumber = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const cleanText = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 1000) : null);

export function parseMeasurement(b = {}) {
  if (!isDate(b.measured_on)) throw new HttpError(400, 'Fecha inválida');
  const values = {};
  for (const [field, [min, max]] of Object.entries(MEASUREMENT_FIELDS)) {
    const n = toNumber(b[field]);
    if (n !== null && !(n >= min && n <= max)) throw new HttpError(400, `Valor fuera de rango en ${field} (${min} a ${max})`);
    values[field] = n;
  }
  if (Object.values(values).every((v) => v === null)) throw new HttpError(400, 'Ingresa al menos una medida');
  return { measured_on: b.measured_on, ...values, notes: cleanText(b.notes) };
}

export function parseStrength(b = {}) {
  const exercise = cleanText(b.exercise)?.slice(0, 80);
  if (!exercise) throw new HttpError(400, 'Indica el ejercicio');
  if (!isDate(b.recorded_on)) throw new HttpError(400, 'Fecha inválida');
  const load = toNumber(b.load_kg);
  if (!(load >= 0 && load <= 1000)) throw new HttpError(400, 'Peso inválido (0 a 1000 kg)');
  const reps = b.reps === '' || b.reps == null ? 1 : Number(b.reps);
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) throw new HttpError(400, 'Repeticiones inválidas (1 a 100)');
  return { exercise, recorded_on: b.recorded_on, load_kg: load, reps, notes: cleanText(b.notes) };
}

export async function loadProgress(db, userId) {
  const [user, measurements, strength] = await Promise.all([
    db.query('SELECT goal FROM users WHERE id = $1', [userId]),
    db.query(
      `SELECT id, measured_on, ${Object.keys(MEASUREMENT_FIELDS).join(', ')}, notes
       FROM body_measurements WHERE user_id = $1 ORDER BY measured_on, id`,
      [userId],
    ),
    db.query(
      `SELECT id, exercise, recorded_on, load_kg, reps, notes
       FROM strength_records WHERE user_id = $1 ORDER BY recorded_on, id`,
      [userId],
    ),
  ]);
  return { goal: user.rows[0]?.goal ?? null, measurements: measurements.rows, strength: strength.rows };
}
