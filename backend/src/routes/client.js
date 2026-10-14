import { Router } from 'express';
import { query, tx, TODAY, TZ } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  LATE_CANCEL_HOURS,
  OCCUPYING,
  activeMemberships,
  cancelReservation,
  createEvaluation,
  createReservation,
  ensureSlots,
} from '../booking.js';
import {
  BOOKING_HORIZON_DAYS,
  EVALUATION_PRICE,
  FOUNDER_BOOKING_HORIZON_DAYS,
  FREEZE_POLICY,
  creditableEvaluation,
  freezeMembership,
  memberStatus,
  membershipFreezes,
} from '../membership.js';

const router = Router();

router.get('/plans', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, code, name, class_type, sessions, duration_months, price_regular, price_founder, price_founder_bonus
     FROM plans WHERE active ORDER BY class_type DESC, sessions`,
  );
  res.json({ plans: rows });
});

router.get('/config', (_req, res) => {
  res.json({
    lateCancelHours: LATE_CANCEL_HOURS,
    bookingHorizonDays: BOOKING_HORIZON_DAYS,
    founderBookingHorizonDays: FOUNDER_BOOKING_HORIZON_DAYS,
    evaluationPrice: EVALUATION_PRICE,
    freezePolicy: FREEZE_POLICY,
  });
});

router.use(requireAuth);

router.get('/slots', async (req, res) => {
  await ensureSlots();
  const status = await memberStatus({ query }, req.user.id);
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 22);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
  const { rows } = await query(
    `SELECT s.id, s.starts_at, s.ends_at, s.class_type, s.capacity, s.founders_only,
            (SELECT count(*)::int FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING}) AS taken,
            (SELECT r.id FROM reservations r WHERE r.slot_id = s.id AND r.user_id = $3 AND r.status = 'booked' LIMIT 1)
              AS my_reservation_id
     FROM class_slots s
     WHERE s.status = 'open' AND s.class_type = 'semi' AND (NOT s.founders_only OR $4::bool)
       AND s.starts_at >= (coalesce($1::date, ${TODAY}))::timestamp AT TIME ZONE '${TZ}'
       AND s.starts_at < (coalesce($1::date, ${TODAY}) + $2::int)::timestamp AT TIME ZONE '${TZ}'
     ORDER BY s.starts_at, s.class_type`,
    [from, days, req.user.id, status.founder],
  );
  res.json({ slots: rows });
});

router.get('/evaluation/slots', async (req, res) => {
  await ensureSlots();
  const status = await memberStatus({ query }, req.user.id);
  const { rows } = await query(
    `SELECT s.id, s.starts_at, s.ends_at
     FROM class_slots s
     WHERE s.status = 'open' AND s.class_type = 'personal' AND NOT s.founders_only
       AND s.starts_at > now() AND s.starts_at <= now() + make_interval(days => $1)
       AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING})
     ORDER BY s.starts_at`,
    [status.booking_horizon_days],
  );
  res.json({ slots: rows });
});

router.get('/me/memberships', async (req, res) => {
  const db = { query };
  const [memberships, status, credit] = await Promise.all([
    activeMemberships(db, req.user.id),
    memberStatus(db, req.user.id),
    creditableEvaluation(db, req.user.id),
  ]);
  const freezes = await membershipFreezes(db, memberships.map((m) => m.id));
  res.json({
    memberships: memberships.map((m) => ({ ...m, freezes: freezes[m.id] || [] })),
    status,
    evaluation_credit: credit?.amount ?? 0,
  });
});

router.post('/me/memberships/:id/freezes', async (req, res) => {
  const b = req.body || {};
  const result = await tx((db) =>
    freezeMembership(db, Number(req.params.id), {
      startDate: b.start_date,
      days: b.days,
      reason: b.reason,
      userId: req.user.id,
    }),
  );
  res.status(201).json(result);
});

router.get('/me/reservations', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.status, r.created_at, s.starts_at, s.ends_at, s.class_type,
            e.id IS NOT NULL AS is_evaluation, e.amount AS evaluation_amount, e.payment_status AS evaluation_payment
     FROM reservations r JOIN class_slots s ON s.id = r.slot_id
     LEFT JOIN evaluations e ON e.reservation_id = r.id
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

router.post('/evaluations', async (req, res) => {
  const result = await tx((db) => createEvaluation(db, req.user.id, Number(req.body?.slot_id)));
  res.status(201).json(result);
});

router.delete('/reservations/:id', async (req, res) => {
  const result = await tx((db) => cancelReservation(db, Number(req.params.id), { userId: req.user.id }));
  res.json(result);
});

export default router;
