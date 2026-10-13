import { Router } from 'express';
import { query, tx, TZ } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  BOOKING_HORIZON_DAYS,
  LATE_CANCEL_HOURS,
  OCCUPYING,
  activeMemberships,
  cancelReservation,
  createReservation,
  ensureSlots,
} from '../booking.js';

const router = Router();

router.get('/plans', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, code, name, class_type, sessions, price_regular, price_founder
     FROM plans WHERE active ORDER BY class_type DESC, sessions`,
  );
  res.json({ plans: rows });
});

router.get('/config', (_req, res) => {
  res.json({ lateCancelHours: LATE_CANCEL_HOURS, bookingHorizonDays: BOOKING_HORIZON_DAYS });
});

router.use(requireAuth);

router.get('/slots', async (req, res) => {
  await ensureSlots();
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 21);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
  const { rows } = await query(
    `SELECT s.id, s.starts_at, s.ends_at, s.class_type, s.capacity,
            (SELECT count(*)::int FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING}) AS taken,
            (SELECT r.id FROM reservations r WHERE r.slot_id = s.id AND r.user_id = $3 AND r.status = 'booked' LIMIT 1)
              AS my_reservation_id
     FROM class_slots s
     WHERE s.status = 'open' AND s.class_type = 'semi'
       AND s.starts_at >= (coalesce($1::date, current_date))::timestamp AT TIME ZONE '${TZ}'
       AND s.starts_at < (coalesce($1::date, current_date) + $2::int)::timestamp AT TIME ZONE '${TZ}'
     ORDER BY s.starts_at, s.class_type`,
    [from, days, req.user.id],
  );
  res.json({ slots: rows });
});

router.get('/me/memberships', async (req, res) => {
  res.json({ memberships: await activeMemberships({ query }, req.user.id) });
});

router.get('/me/reservations', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.status, r.created_at, s.starts_at, s.ends_at, s.class_type
     FROM reservations r JOIN class_slots s ON s.id = r.slot_id
     WHERE r.user_id = $1 AND s.starts_at >= now() - interval '30 days'
     ORDER BY s.starts_at DESC`,
    [req.user.id],
  );
  res.json({ reservations: rows });
});

router.post('/reservations', async (req, res) => {
  const reservation = await tx((db) =>
    createReservation(db, req.user.id, Number(req.body?.slot_id), { allowPersonal: false }),
  );
  res.status(201).json({ reservation });
});

router.delete('/reservations/:id', async (req, res) => {
  const result = await tx((db) => cancelReservation(db, Number(req.params.id), { userId: req.user.id }));
  res.json(result);
});

export default router;
