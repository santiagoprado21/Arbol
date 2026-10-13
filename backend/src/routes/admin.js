import { Router } from 'express';
import { one, query, tx, TZ } from '../db.js';
import { HttpError, publicUser, requireAdmin, requireAuth } from '../auth.js';
import { CONSUMING, OCCUPYING, cancelReservation, createReservation, ensureSlots } from '../booking.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function alertFor(c) {
  if (!c.membership_id) return { code: 'no_plan', label: 'Sin plan' };
  if (c.days_left < 0) return { code: 'expired', label: `Vencido hace ${-c.days_left} d` };
  if (c.payment_status === 'pending') return { code: 'pending', label: 'Pago pendiente' };
  const remaining = c.sessions_total - c.sessions_used;
  if (c.days_left <= 5) return { code: 'expiring', label: `Vence en ${c.days_left} d` };
  if (remaining <= 1) return { code: 'expiring', label: `${remaining} sesión restante` };
  return { code: 'ok', label: 'Al día' };
}

async function clientsSummary() {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.cedula, u.client_type, u.status, u.created_at,
            m.id AS membership_id, m.start_date, m.end_date, m.sessions_total, m.amount, m.payment_status,
            p.name AS plan_name, p.class_type,
            (SELECT count(*)::int FROM reservations r WHERE r.membership_id = m.id AND r.status IN ${CONSUMING})
              AS sessions_used,
            (m.end_date - current_date)::int AS days_left,
            (SELECT max(s.starts_at) FROM reservations r JOIN class_slots s ON s.id = r.slot_id
              WHERE r.user_id = u.id AND r.status = 'attended') AS last_attended
     FROM users u
     LEFT JOIN LATERAL (
       SELECT * FROM memberships mm WHERE mm.user_id = u.id
       ORDER BY (current_date BETWEEN mm.start_date AND mm.end_date) DESC, mm.end_date DESC LIMIT 1
     ) m ON true
     LEFT JOIN plans p ON p.id = m.plan_id
     WHERE u.role = 'client'
     ORDER BY u.full_name`,
  );
  return rows.map((c) => ({ ...c, alert: alertFor(c) }));
}

router.get('/stats', async (_req, res) => {
  const [clients, active, pending, revenue, today, attendance, series, occupancy, summary] = await Promise.all([
    one(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE client_type = 'essential')::int AS essential,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month
         FROM users WHERE role = 'client'`),
    one(`SELECT count(DISTINCT user_id)::int AS n FROM memberships
         WHERE current_date BETWEEN start_date AND end_date`),
    one(`SELECT count(*)::int AS n, coalesce(sum(amount), 0)::int AS total
         FROM memberships WHERE payment_status = 'pending'`),
    one(`SELECT coalesce(sum(amount), 0)::int AS total FROM memberships
         WHERE payment_status = 'paid' AND date_trunc('month', paid_at) = date_trunc('month', now())`),
    one(`SELECT count(*)::int AS slots, coalesce(sum(s.capacity), 0)::int AS capacity,
                coalesce(sum((SELECT count(*) FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING})), 0)::int
                  AS booked
         FROM class_slots s
         WHERE s.status = 'open' AND (s.starts_at AT TIME ZONE '${TZ}')::date = current_date`),
    one(`SELECT count(*) FILTER (WHERE r.status = 'attended')::int AS attended,
                count(*) FILTER (WHERE r.status = 'no_show')::int AS no_show,
                count(*) FILTER (WHERE r.status = 'late_cancel')::int AS late_cancel
         FROM reservations r JOIN class_slots s ON s.id = r.slot_id
         WHERE s.starts_at >= now() - interval '30 days' AND s.starts_at < now()`),
    query(`SELECT d::date::text AS day,
                  count(r.id) FILTER (WHERE r.status IN ${OCCUPYING})::int AS reservations,
                  count(r.id) FILTER (WHERE r.status = 'attended')::int AS attended
           FROM generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') d
           LEFT JOIN class_slots s ON (s.starts_at AT TIME ZONE '${TZ}')::date = d::date
           LEFT JOIN reservations r ON r.slot_id = s.id
           GROUP BY d ORDER BY d`),
    query(`SELECT s.class_type, sum(s.capacity)::int AS capacity,
                  coalesce(sum((SELECT count(*) FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING})), 0)::int
                    AS booked
           FROM class_slots s
           WHERE s.status = 'open' AND s.starts_at >= now() AND s.starts_at < now() + interval '7 days'
           GROUP BY s.class_type`),
    clientsSummary(),
  ]);

  const attention = summary
    .filter((c) => ['expired', 'pending', 'expiring'].includes(c.alert.code))
    .sort((a, b) => (a.days_left ?? -999) - (b.days_left ?? -999))
    .slice(0, 10);

  res.json({
    clients: { ...clients, active: active.n, without_plan: summary.filter((c) => c.alert.code === 'no_plan').length },
    expiring_soon: summary.filter((c) => c.days_left !== null && c.days_left >= 0 && c.days_left <= 7).length,
    pending_payments: pending,
    revenue_month: revenue.total,
    today,
    attendance,
    series: series.rows,
    occupancy: occupancy.rows,
    attention,
  });
});

router.get('/clients', async (_req, res) => {
  res.json({ clients: await clientsSummary() });
});

router.get('/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await one(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!user) throw new HttpError(404, 'Cliente no encontrado');
  const [memberships, reservations] = await Promise.all([
    query(
      `SELECT m.*, p.name AS plan_name, p.class_type,
              (SELECT count(*)::int FROM reservations r WHERE r.membership_id = m.id AND r.status IN ${CONSUMING})
                AS sessions_used,
              (m.end_date - current_date)::int AS days_left
       FROM memberships m JOIN plans p ON p.id = m.plan_id
       WHERE m.user_id = $1 ORDER BY m.start_date DESC`,
      [id],
    ),
    query(
      `SELECT r.id, r.status, r.created_at, s.starts_at, s.class_type
       FROM reservations r JOIN class_slots s ON s.id = r.slot_id
       WHERE r.user_id = $1 ORDER BY s.starts_at DESC LIMIT 60`,
      [id],
    ),
  ]);
  res.json({ user: publicUser(user), memberships: memberships.rows, reservations: reservations.rows });
});

router.patch('/clients/:id', async (req, res) => {
  const allowed = ['full_name', 'phone', 'cedula', 'client_type', 'status', 'medical_notes', 'admin_notes'];
  const entries = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) throw new HttpError(400, 'Nada para actualizar');
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const user = await one(
    `UPDATE users SET ${sets} WHERE id = $1 AND role = 'client' RETURNING *`,
    [Number(req.params.id), ...entries.map(([, v]) => (v === '' ? null : v))],
  );
  if (!user) throw new HttpError(404, 'Cliente no encontrado');
  res.json({ user: publicUser(user) });
});

router.post('/clients/:id/memberships', async (req, res) => {
  const userId = Number(req.params.id);
  const b = req.body || {};
  const plan = await one('SELECT * FROM plans WHERE id = $1', [Number(b.plan_id)]);
  if (!plan) throw new HttpError(400, 'Plan inválido');
  const user = await one(`SELECT client_type FROM users WHERE id = $1 AND role = 'client'`, [userId]);
  if (!user) throw new HttpError(404, 'Cliente no encontrado');

  const defaultAmount =
    user.client_type === 'essential' && plan.price_essential != null ? plan.price_essential : plan.price_regular;
  const paid = b.payment_status === 'paid';
  const membership = await one(
    `INSERT INTO memberships
       (user_id, plan_id, start_date, end_date, sessions_total, amount, payment_status, payment_method,
        payment_reference, paid_at, notes)
     VALUES ($1, $2, coalesce($3::date, current_date),
             coalesce($4::date, (coalesce($3::date, current_date) + interval '1 month' - interval '1 day')::date),
             $5, $6, $7, $8, $9, CASE WHEN $7 = 'paid' THEN now() END, $10)
     RETURNING *`,
    [
      userId,
      plan.id,
      isDate(b.start_date) ? b.start_date : null,
      isDate(b.end_date) ? b.end_date : null,
      Number(b.sessions_total) || plan.sessions,
      b.amount === undefined || b.amount === '' ? defaultAmount : Number(b.amount),
      paid ? 'paid' : 'pending',
      b.payment_method || null,
      b.payment_reference || null,
      b.notes || null,
    ],
  );
  res.status(201).json({ membership });
});

router.patch('/memberships/:id', async (req, res) => {
  const b = req.body || {};
  const membership = await one(
    `UPDATE memberships SET
       payment_status    = coalesce($2, payment_status),
       payment_method    = coalesce($3, payment_method),
       payment_reference = coalesce($4, payment_reference),
       amount            = coalesce($5, amount),
       end_date          = coalesce($6::date, end_date),
       sessions_total    = coalesce($7, sessions_total),
       paid_at = CASE WHEN $2 = 'paid' AND paid_at IS NULL THEN now()
                      WHEN $2 = 'pending' THEN NULL ELSE paid_at END
     WHERE id = $1 RETURNING *`,
    [
      Number(req.params.id),
      ['paid', 'pending'].includes(b.payment_status) ? b.payment_status : null,
      b.payment_method ?? null,
      b.payment_reference ?? null,
      b.amount != null && b.amount !== '' ? Number(b.amount) : null,
      isDate(b.end_date) ? b.end_date : null,
      b.sessions_total ? Number(b.sessions_total) : null,
    ],
  );
  if (!membership) throw new HttpError(404, 'Membresía no encontrada');
  res.json({ membership });
});

router.delete('/memberships/:id', async (req, res) => {
  await query('DELETE FROM memberships WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
});

router.get('/agenda', async (req, res) => {
  await ensureSlots();
  const date = isDate(req.query.date) ? req.query.date : null;
  const { rows } = await query(
    `SELECT s.id, s.starts_at, s.ends_at, s.class_type, s.capacity, s.status,
            coalesce(json_agg(json_build_object(
              'id', r.id, 'status', r.status, 'user_id', u.id, 'full_name', u.full_name, 'phone', u.phone,
              'client_type', u.client_type
            ) ORDER BY u.full_name) FILTER (WHERE r.id IS NOT NULL), '[]') AS attendees
     FROM class_slots s
     LEFT JOIN reservations r ON r.slot_id = s.id AND r.status <> 'cancelled'
     LEFT JOIN users u ON u.id = r.user_id
     WHERE (s.starts_at AT TIME ZONE '${TZ}')::date = coalesce($1::date, current_date)
     GROUP BY s.id ORDER BY s.starts_at, s.class_type`,
    [date],
  );
  res.json({ slots: rows });
});

router.patch('/slots/:id', async (req, res) => {
  const b = req.body || {};
  const slot = await one(
    `UPDATE class_slots SET status = coalesce($2, status), capacity = coalesce($3, capacity)
     WHERE id = $1 RETURNING *`,
    [
      Number(req.params.id),
      ['open', 'cancelled'].includes(b.status) ? b.status : null,
      b.capacity ? Number(b.capacity) : null,
    ],
  );
  if (!slot) throw new HttpError(404, 'Horario no encontrado');
  if (slot.status === 'cancelled') {
    await query(`UPDATE reservations SET status = 'cancelled', cancelled_at = now()
                 WHERE slot_id = $1 AND status = 'booked'`, [slot.id]);
  }
  res.json({ slot });
});

router.post('/reservations', async (req, res) => {
  const reservation = await tx((db) =>
    createReservation(db, Number(req.body?.user_id), Number(req.body?.slot_id)),
  );
  res.status(201).json({ reservation });
});

router.patch('/reservations/:id', async (req, res) => {
  const status = req.body?.status;
  if (status === 'cancelled') {
    const result = await tx((db) => cancelReservation(db, Number(req.params.id), { asAdmin: true }));
    return res.json(result);
  }
  if (!['booked', 'attended', 'no_show', 'late_cancel'].includes(status)) {
    throw new HttpError(400, 'Estado inválido');
  }
  const reservation = await one(
    `UPDATE reservations SET status = $2 WHERE id = $1 RETURNING *`,
    [Number(req.params.id), status],
  );
  if (!reservation) throw new HttpError(404, 'Reserva no encontrada');
  res.json({ reservation });
});

router.get('/templates', async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM schedule_templates WHERE active ORDER BY weekday, start_time, class_type`,
  );
  res.json({ templates: rows });
});

router.post('/templates', async (req, res) => {
  const b = req.body || {};
  const weekdays = (Array.isArray(b.weekdays) ? b.weekdays : [b.weekday]).map(Number);
  if (!/^\d{2}:\d{2}$/.test(b.start_time || '')) throw new HttpError(400, 'Hora inválida (HH:MM)');
  if (!['semi', 'personal'].includes(b.class_type)) throw new HttpError(400, 'Tipo de clase inválido');
  if (weekdays.some((d) => !(d >= 0 && d <= 6))) throw new HttpError(400, 'Día inválido');
  const capacity = Number(b.capacity) || (b.class_type === 'semi' ? 6 : 1);
  const duration = Number(b.duration_min) || 60;

  for (const weekday of weekdays) {
    await query(
      `INSERT INTO schedule_templates (weekday, start_time, duration_min, class_type, capacity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (weekday, start_time, class_type)
       DO UPDATE SET active = true, capacity = EXCLUDED.capacity, duration_min = EXCLUDED.duration_min`,
      [weekday, b.start_time, duration, b.class_type, capacity],
    );
  }
  await ensureSlots();
  res.status(201).json({ ok: true });
});

router.delete('/templates/:id', async (req, res) => {
  const t = await one(
    `UPDATE schedule_templates SET active = false WHERE id = $1 RETURNING *`,
    [Number(req.params.id)],
  );
  if (!t) throw new HttpError(404, 'Horario no encontrado');
  await query(
    `DELETE FROM class_slots s
     WHERE s.starts_at > now() AND s.class_type = $1
       AND extract(dow FROM s.starts_at AT TIME ZONE '${TZ}')::int = $2
       AND to_char(s.starts_at AT TIME ZONE '${TZ}', 'HH24:MI') = $3
       AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.slot_id = s.id AND r.status <> 'cancelled')`,
    [t.class_type, t.weekday, t.start_time],
  );
  res.status(204).end();
});

router.get('/plans', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM plans ORDER BY class_type DESC, sessions`);
  res.json({ plans: rows });
});

router.patch('/plans/:id', async (req, res) => {
  const b = req.body || {};
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const plan = await one(
    `UPDATE plans SET
       name = coalesce($2, name),
       price_regular = coalesce($3, price_regular),
       price_essential = $4,
       active = coalesce($5, active)
     WHERE id = $1 RETURNING *`,
    [Number(req.params.id), b.name || null, num(b.price_regular), num(b.price_essential), b.active ?? null],
  );
  if (!plan) throw new HttpError(404, 'Plan no encontrado');
  res.json({ plan });
});

export default router;
