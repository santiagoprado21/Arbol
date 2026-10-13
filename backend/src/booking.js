import { query, TZ } from './db.js';
import { HttpError } from './auth.js';

export const LATE_CANCEL_HOURS = 12;
export const BOOKING_HORIZON_DAYS = 14;
export const SLOT_GENERATION_DAYS = 21;

// Statuses that consume a session from the client's plan.
export const CONSUMING = `('booked','attended','no_show','late_cancel')`;
// Statuses that occupy a physical spot in the class.
export const OCCUPYING = `('booked','attended','no_show')`;

export async function ensureSlots(days = SLOT_GENERATION_DAYS) {
  await query(
    `INSERT INTO class_slots (starts_at, ends_at, class_type, capacity)
     SELECT (d::date + t.start_time::time) AT TIME ZONE '${TZ}',
            (d::date + t.start_time::time + make_interval(mins => t.duration_min)) AT TIME ZONE '${TZ}',
            t.class_type, t.capacity
     FROM generate_series(current_date::timestamp, (current_date + $1::int)::timestamp, interval '1 day') d
     JOIN schedule_templates t ON t.active AND t.weekday = extract(dow FROM d)::int
     ON CONFLICT (starts_at, class_type) DO NOTHING`,
    [days],
  );
}

export async function activeMemberships(db, userId) {
  const { rows } = await db.query(
    `SELECT m.id, m.start_date, m.end_date, m.sessions_total, m.amount, m.payment_status,
            p.name AS plan_name, p.class_type,
            (SELECT count(*)::int FROM reservations r
              WHERE r.membership_id = m.id AND r.status IN ${CONSUMING}) AS sessions_used,
            (m.end_date - current_date)::int AS days_left
     FROM memberships m JOIN plans p ON p.id = m.plan_id
     WHERE m.user_id = $1 AND m.end_date >= current_date
     ORDER BY m.start_date`,
    [userId],
  );
  return rows;
}

export async function createReservation(db, userId, slotId, { allowPersonal = true } = {}) {
  const { rows: [user] } = await db.query('SELECT id, status FROM users WHERE id = $1', [userId]);
  if (!user) throw new HttpError(404, 'Cliente no encontrado');
  if (user.status !== 'active') throw new HttpError(403, 'Tu cuenta está en pausa. Escríbenos para reactivarla.');

  const { rows: [slot] } = await db.query('SELECT * FROM class_slots WHERE id = $1 FOR UPDATE', [slotId]);
  if (!slot || slot.status !== 'open') throw new HttpError(404, 'Este horario no está disponible');
  if (slot.class_type === 'personal' && !allowPersonal) {
    throw new HttpError(403, 'Las sesiones personalizadas se agendan por WhatsApp con tu coach');
  }

  const startsAt = new Date(slot.starts_at);
  if (startsAt <= new Date()) throw new HttpError(400, 'Este horario ya pasó');
  if (startsAt - Date.now() > BOOKING_HORIZON_DAYS * 864e5) {
    throw new HttpError(400, `Solo puedes reservar con ${BOOKING_HORIZON_DAYS} días de anticipación`);
  }

  const { rows: [{ taken }] } = await db.query(
    `SELECT count(*)::int AS taken FROM reservations WHERE slot_id = $1 AND status IN ${OCCUPYING}`,
    [slotId],
  );
  if (taken >= slot.capacity) throw new HttpError(409, 'Este horario ya está lleno');

  const { rows: [existing] } = await db.query(
    `SELECT id FROM reservations WHERE slot_id = $1 AND user_id = $2 AND status <> 'cancelled'`,
    [slotId, userId],
  );
  if (existing) throw new HttpError(409, 'Ya tienes una reserva en este horario');

  const { rows: memberships } = await db.query(
    `SELECT m.id, m.sessions_total,
            (SELECT count(*)::int FROM reservations r
              WHERE r.membership_id = m.id AND r.status IN ${CONSUMING}) AS used
     FROM memberships m JOIN plans p ON p.id = m.plan_id
     WHERE m.user_id = $1 AND p.class_type = $2
       AND ($3::timestamptz AT TIME ZONE '${TZ}')::date BETWEEN m.start_date AND m.end_date
     ORDER BY m.end_date
     FOR UPDATE OF m`,
    [userId, slot.class_type, slot.starts_at],
  );
  if (memberships.length === 0) {
    throw new HttpError(402, 'No tienes un plan activo para este tipo de clase en esa fecha');
  }
  const membership = memberships.find((m) => m.used < m.sessions_total);
  if (!membership) throw new HttpError(402, 'Ya usaste todas las sesiones de tu plan');

  const { rows: [reservation] } = await db.query(
    `INSERT INTO reservations (slot_id, user_id, membership_id) VALUES ($1, $2, $3) RETURNING *`,
    [slotId, userId, membership.id],
  );
  return reservation;
}

export async function cancelReservation(db, reservationId, { userId, asAdmin = false }) {
  const { rows: [r] } = await db.query(
    `SELECT r.*, s.starts_at FROM reservations r JOIN class_slots s ON s.id = r.slot_id
     WHERE r.id = $1 FOR UPDATE OF r`,
    [reservationId],
  );
  if (!r || (!asAdmin && r.user_id !== userId)) throw new HttpError(404, 'Reserva no encontrada');
  if (r.status !== 'booked') throw new HttpError(400, 'Esta reserva ya no se puede cancelar');

  const hoursLeft = (new Date(r.starts_at) - Date.now()) / 36e5;
  if (hoursLeft <= 0 && !asAdmin) throw new HttpError(400, 'La clase ya comenzó');

  const status = asAdmin || hoursLeft >= LATE_CANCEL_HOURS ? 'cancelled' : 'late_cancel';
  await db.query(`UPDATE reservations SET status = $2, cancelled_at = now() WHERE id = $1`, [r.id, status]);
  return {
    status,
    message:
      status === 'cancelled'
        ? 'Reserva cancelada. La sesión vuelve a tu plan.'
        : `Cancelaste con menos de ${LATE_CANCEL_HOURS} horas: la sesión se descuenta de tu plan.`,
  };
}
