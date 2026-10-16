import { Router } from 'express';
import { one, query, tx, TODAY, TZ } from '../db.js';
import { HttpError, publicUser, requireAdmin, requireAuth } from '../auth.js';
import { CONSUMING, FLEX_MAX_CAPACITY, OCCUPYING, cancelReservation, createEvaluation, createReservation, ensureSlots } from '../booking.js';
import {
  freezeMembership,
  founderUntilSql,
  memberStatus,
  membershipFreezes,
  quotePlan,
  removeFreeze,
} from '../membership.js';

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
    `SELECT u.id, u.full_name, u.email, u.phone, u.cedula, u.client_type, u.status, u.created_at, u.invited_by,
            ${founderUntilSql('u.id')} AS founder_until,
            m.id AS membership_id, m.start_date, m.end_date, m.sessions_total, m.amount, m.payment_status,
            p.name AS plan_name, p.class_type,
            (SELECT count(*)::int FROM reservations r WHERE r.membership_id = m.id AND r.status IN ${CONSUMING})
              AS sessions_used,
            (m.end_date - ${TODAY})::int AS days_left,
            (SELECT max(s.starts_at) FROM reservations r JOIN class_slots s ON s.id = r.slot_id
              WHERE r.user_id = u.id AND r.status = 'attended') AS last_attended
     FROM users u
     LEFT JOIN LATERAL (
       SELECT mm.* FROM memberships mm JOIN plans mp ON mp.id = mm.plan_id
       WHERE mm.user_id = u.id AND mp.class_type <> 'membership'
       ORDER BY (${TODAY} BETWEEN mm.start_date AND mm.end_date) DESC, mm.end_date DESC LIMIT 1
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
                count(*) FILTER (WHERE client_type = 'founder')::int AS founder,
                count(*) FILTER (WHERE client_type = 'founder_guest')::int AS founder_guest,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month
         FROM users WHERE role = 'client'`),
    one(`SELECT count(DISTINCT m.user_id)::int AS n FROM memberships m
         JOIN users u ON u.id = m.user_id AND u.role = 'client'
         JOIN plans p ON p.id = m.plan_id AND p.class_type <> 'membership'
         WHERE m.end_date >= ${TODAY}`),
    one(`SELECT count(*)::int AS n, coalesce(sum(amount), 0)::int AS total FROM (
           SELECT amount FROM memberships WHERE payment_status = 'pending'
           UNION ALL
           SELECT e.amount FROM evaluations e JOIN reservations r ON r.id = e.reservation_id
           WHERE e.payment_status = 'pending' AND r.status <> 'cancelled'
         ) pending`),
    one(`SELECT coalesce(sum(amount), 0)::int AS total FROM (
           SELECT amount, paid_at FROM memberships WHERE payment_status = 'paid'
           UNION ALL
           SELECT amount, paid_at FROM evaluations WHERE payment_status = 'paid'
         ) paid
         WHERE date_trunc('month', paid_at) = date_trunc('month', now())`),
    one(`SELECT count(*)::int AS slots, coalesce(sum(s.capacity), 0)::int AS capacity,
                coalesce(sum((SELECT count(*) FROM reservations r WHERE r.slot_id = s.id AND r.status IN ${OCCUPYING})), 0)::int
                  AS booked
         FROM class_slots s
         WHERE s.status = 'open' AND (s.starts_at AT TIME ZONE '${TZ}')::date = ${TODAY}`),
    one(`SELECT count(*) FILTER (WHERE r.status = 'attended')::int AS attended,
                count(*) FILTER (WHERE r.status = 'no_show')::int AS no_show,
                count(*) FILTER (WHERE r.status = 'late_cancel')::int AS late_cancel
         FROM reservations r JOIN class_slots s ON s.id = r.slot_id
         WHERE s.starts_at >= now() - interval '30 days' AND s.starts_at < now()`),
    query(`SELECT d::date::text AS day,
                  count(r.id) FILTER (WHERE r.status IN ${OCCUPYING})::int AS reservations,
                  count(r.id) FILTER (WHERE r.status = 'attended')::int AS attended
           FROM generate_series((${TODAY} - 13)::timestamp, ${TODAY}::timestamp, interval '1 day') d
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
  const db = { query };
  const [memberships, reservations, guests, status] = await Promise.all([
    query(
      `SELECT m.*, p.name AS plan_name, p.class_type,
              (SELECT count(*)::int FROM reservations r WHERE r.membership_id = m.id AND r.status IN ${CONSUMING})
                AS sessions_used,
              (m.end_date - ${TODAY})::int AS days_left,
              (SELECT e.amount FROM evaluations e WHERE e.credited_membership_id = m.id LIMIT 1) AS evaluation_credit
       FROM memberships m JOIN plans p ON p.id = m.plan_id
       WHERE m.user_id = $1 ORDER BY m.start_date DESC`,
      [id],
    ),
    query(
      `SELECT r.id, r.status, r.created_at, s.starts_at, s.class_type,
              e.id AS evaluation_id, e.amount AS evaluation_amount, e.payment_status AS evaluation_payment,
              e.credited_membership_id
       FROM reservations r JOIN class_slots s ON s.id = r.slot_id
       LEFT JOIN evaluations e ON e.reservation_id = r.id
       WHERE r.user_id = $1 ORDER BY s.starts_at DESC LIMIT 60`,
      [id],
    ),
    query(`SELECT id, full_name FROM users WHERE invited_by = $1 ORDER BY full_name`, [id]),
    memberStatus(db, id),
  ]);
  const freezes = await membershipFreezes(db, memberships.rows.map((m) => m.id));
  res.json({
    user: publicUser(user),
    status,
    guests: guests.rows,
    memberships: memberships.rows.map((m) => ({ ...m, freezes: freezes[m.id] || [] })),
    reservations: reservations.rows,
  });
});

router.patch('/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  const allowed = [
    'full_name', 'phone', 'cedula', 'client_type', 'status', 'medical_notes', 'admin_notes',
    'invited_by', 'founder_bonus_active',
  ];
  const body = Object.fromEntries(
    Object.entries(req.body || {})
      .filter(([k]) => allowed.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v]),
  );
  if (Object.keys(body).length === 0) throw new HttpError(400, 'Nada para actualizar');

  const current = await one(`SELECT client_type FROM users WHERE id = $1 AND role = 'client'`, [id]);
  if (!current) throw new HttpError(404, 'Cliente no encontrado');
  if ((body.client_type ?? current.client_type) !== 'founder_guest') {
    body.invited_by = null;
  } else if (body.invited_by != null) {
    const hostId = Number(body.invited_by);
    const host = await one(`SELECT client_type FROM users WHERE id = $1 AND role = 'client'`, [hostId]);
    if (!host || host.client_type !== 'founder' || hostId === id) {
      throw new HttpError(400, 'El anfitrión debe ser otro cliente Founder');
    }
    const other = await one(`SELECT full_name FROM users WHERE invited_by = $1 AND id <> $2`, [hostId, id]);
    if (other) throw new HttpError(409, `Ese Founder ya tiene como invitado a ${other.full_name}`);
    body.invited_by = hostId;
  }

  const entries = Object.entries(body);
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const user = await one(
    `UPDATE users SET ${sets} WHERE id = $1 AND role = 'client' RETURNING *`,
    [id, ...entries.map(([, v]) => v)],
  );
  res.json({ user: publicUser(user) });
});

async function loadQuoteInputs(db, userId, b) {
  const { rows: [plan] } = await db.query('SELECT * FROM plans WHERE id = $1', [Number(b.plan_id)]);
  if (!plan) throw new HttpError(400, 'Plan inválido');
  const { rows: [user] } = await db.query(
    `SELECT client_type, ${TODAY}::text AS today FROM users WHERE id = $1 AND role = 'client'`,
    [userId],
  );
  if (!user) throw new HttpError(404, 'Cliente no encontrado');
  return { plan, user, startDate: isDate(b.start_date) ? b.start_date : user.today };
}

router.get('/clients/:id/quote', async (req, res) => {
  const db = { query };
  const userId = Number(req.params.id);
  const { plan, startDate } = await loadQuoteInputs(db, userId, req.query);
  res.json({ quote: await quotePlan(db, userId, plan, startDate) });
});

router.post('/clients/:id/memberships', async (req, res) => {
  const userId = Number(req.params.id);
  const b = req.body || {};
  const membership = await tx(async (db) => {
    const { plan, user, startDate } = await loadQuoteInputs(db, userId, b);
    const quote = await quotePlan(db, userId, plan, startDate);
    const customAmount = b.amount !== undefined && b.amount !== '';
    const { rows: [m] } = await db.query(
      `INSERT INTO memberships
         (user_id, plan_id, start_date, end_date, sessions_total, amount, price_tier, payment_status,
          payment_method, payment_reference, paid_at, notes)
       VALUES ($1, $2, $3::date,
               coalesce($4::date, ($3::date + make_interval(months => $5) - interval '1 day')::date),
               $6, $7, $8, $9, $10, $11, CASE WHEN $9 = 'paid' THEN now() END, $12)
       RETURNING *`,
      [
        userId,
        plan.id,
        startDate,
        isDate(b.end_date) ? b.end_date : null,
        plan.duration_months,
        Number(b.sessions_total) || plan.sessions,
        customAmount ? Number(b.amount) : quote.amount,
        quote.tier,
        b.payment_status === 'paid' ? 'paid' : 'pending',
        b.payment_method || null,
        b.payment_reference || null,
        b.notes || null,
      ],
    );
    if (quote.evaluation_id) {
      await db.query(`UPDATE evaluations SET credited_membership_id = $2 WHERE id = $1`, [quote.evaluation_id, m.id]);
    }
    if (quote.loses_bonus) {
      await db.query(`UPDATE users SET founder_bonus_active = false WHERE id = $1`, [userId]);
    }
    if (plan.class_type === 'membership' && user.client_type !== 'founder') {
      await db.query(`UPDATE users SET client_type = 'founder', invited_by = NULL WHERE id = $1`, [userId]);
    }
    return m;
  });
  res.status(201).json({ membership });
});

router.post('/memberships/:id/freezes', async (req, res) => {
  const b = req.body || {};
  const result = await tx((db) =>
    freezeMembership(db, Number(req.params.id), { startDate: b.start_date, days: b.days, reason: b.reason }),
  );
  res.status(201).json(result);
});

router.delete('/freezes/:id', async (req, res) => {
  await tx((db) => removeFreeze(db, Number(req.params.id)));
  res.status(204).end();
});

router.post('/evaluations', async (req, res) => {
  const result = await tx((db) =>
    createEvaluation(db, Number(req.body?.user_id), Number(req.body?.slot_id), { asAdmin: true }),
  );
  res.status(201).json(result);
});

router.patch('/evaluations/:id', async (req, res) => {
  const b = req.body || {};
  if (!['paid', 'pending'].includes(b.payment_status)) throw new HttpError(400, 'Estado de pago inválido');
  const evaluation = await one(
    `UPDATE evaluations SET payment_status = $2, payment_method = coalesce($3, payment_method),
            paid_at = CASE WHEN $2 = 'paid' THEN coalesce(paid_at, now()) END
     WHERE id = $1 RETURNING *`,
    [Number(req.params.id), b.payment_status, b.payment_method || null],
  );
  if (!evaluation) throw new HttpError(404, 'Valoración no encontrada');
  res.json({ evaluation });
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
    `SELECT s.id, s.starts_at, s.ends_at, s.class_type, s.capacity, s.status, s.founders_only,
            coalesce(json_agg(json_build_object(
              'id', r.id, 'status', r.status, 'user_id', u.id, 'full_name', u.full_name, 'phone', u.phone,
              'client_type', u.client_type, 'founder', u.client_type = 'founder' AND ${founderUntilSql('u.id')} IS NOT NULL,
              'is_evaluation', e.id IS NOT NULL
            ) ORDER BY u.full_name) FILTER (WHERE r.id IS NOT NULL), '[]') AS attendees
     FROM class_slots s
     LEFT JOIN reservations r ON r.slot_id = s.id AND r.status <> 'cancelled'
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN evaluations e ON e.reservation_id = r.id
     WHERE (s.starts_at AT TIME ZONE '${TZ}')::date = coalesce($1::date, ${TODAY})
     GROUP BY s.id ORDER BY s.starts_at, s.class_type`,
    [date],
  );
  res.json({ slots: rows });
});

router.patch('/slots/:id', async (req, res) => {
  const b = req.body || {};
  if (b.capacity) {
    const current = await one('SELECT class_type FROM class_slots WHERE id = $1', [Number(req.params.id)]);
    if (current?.class_type === 'semi' && Number(b.capacity) > FLEX_MAX_CAPACITY) {
      throw new HttpError(400, `Las clases FLEX tienen máximo ${FLEX_MAX_CAPACITY} cupos`);
    }
  }
  const slot = await one(
    `UPDATE class_slots SET status = coalesce($2, status), capacity = coalesce($3, capacity),
            founders_only = coalesce($4, founders_only)
     WHERE id = $1 RETURNING *`,
    [
      Number(req.params.id),
      ['open', 'cancelled'].includes(b.status) ? b.status : null,
      b.capacity ? Number(b.capacity) : null,
      typeof b.founders_only === 'boolean' ? b.founders_only : null,
    ],
  );
  if (!slot) throw new HttpError(404, 'Horario no encontrado');
  if (slot.status === 'cancelled') {
    await query(`UPDATE reservations SET status = 'cancelled', cancelled_at = now()
                 WHERE slot_id = $1 AND status = 'booked'`, [slot.id]);
  }
  res.json({ slot });
});

// A scan confirms the reservation of a class starting up to 60 min from now or that started up to 90 min ago.
router.post('/checkin', async (req, res) => {
  const raw = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const token = raw.replace(/^arbol:checkin:/, '');
  const user = token && (await one(
    `SELECT id, full_name, client_type, status FROM users WHERE checkin_token = $1 AND role = 'client'`,
    [token],
  ));
  if (!user) throw new HttpError(404, 'Este código QR no pertenece a ningún atleta de Árbol');

  const result = await tx(async (db) => {
    const { rows: [r] } = await db.query(
      `SELECT r.id, r.status, s.starts_at, s.class_type, e.id IS NOT NULL AS is_evaluation
       FROM reservations r JOIN class_slots s ON s.id = r.slot_id
       LEFT JOIN evaluations e ON e.reservation_id = r.id
       WHERE r.user_id = $1 AND r.status IN ('booked', 'attended') AND s.status = 'open'
         AND s.starts_at BETWEEN now() - interval '90 minutes' AND now() + interval '60 minutes'
       ORDER BY abs(extract(epoch FROM s.starts_at - now()))
       LIMIT 1
       FOR UPDATE OF r`,
      [user.id],
    );
    if (!r) return { result: 'no_reservation' };
    if (r.status === 'attended') return { result: 'already', reservation: r };
    await db.query(`UPDATE reservations SET status = 'attended' WHERE id = $1`, [r.id]);
    return { result: 'confirmed', reservation: { ...r, status: 'attended' } };
  });

  const { rows: [next] } = await query(
    `SELECT s.starts_at, s.class_type FROM reservations r JOIN class_slots s ON s.id = r.slot_id
     WHERE r.user_id = $1 AND r.status = 'booked' AND s.starts_at > now() ORDER BY s.starts_at LIMIT 1`,
    [user.id],
  );
  res.json({ ...result, user, next_reservation: next || null });
});

router.post('/reservations', async (req, res) => {
  const reservation = await tx((db) =>
    createReservation(db, Number(req.body?.user_id), Number(req.body?.slot_id), { asAdmin: true }),
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
  const capacity = Number(b.capacity) || (b.class_type === 'semi' ? FLEX_MAX_CAPACITY : 1);
  if (b.class_type === 'semi' && capacity > FLEX_MAX_CAPACITY) {
    throw new HttpError(400, `Las clases FLEX tienen máximo ${FLEX_MAX_CAPACITY} cupos`);
  }
  const duration = Number(b.duration_min) || 60;
  const foundersOnly = b.founders_only === true;

  for (const weekday of weekdays) {
    await query(
      `INSERT INTO schedule_templates (weekday, start_time, duration_min, class_type, capacity, founders_only)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (weekday, start_time, class_type)
       DO UPDATE SET active = true, capacity = EXCLUDED.capacity, duration_min = EXCLUDED.duration_min,
                     founders_only = EXCLUDED.founders_only`,
      [weekday, b.start_time, duration, b.class_type, capacity, foundersOnly],
    );
    await query(
      `UPDATE class_slots SET founders_only = $4
       WHERE starts_at > now() AND class_type = $1
         AND extract(dow FROM starts_at AT TIME ZONE '${TZ}')::int = $2
         AND to_char(starts_at AT TIME ZONE '${TZ}', 'HH24:MI') = $3`,
      [b.class_type, weekday, b.start_time, foundersOnly],
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
  const { rows } = await query(
    `SELECT * FROM plans ORDER BY class_type = 'membership' DESC, class_type DESC, sessions`,
  );
  res.json({ plans: rows });
});

router.post('/plans', async (req, res) => {
  const b = req.body || {};
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) throw new HttpError(400, 'Ponle un nombre al plan');
  if (!['semi', 'personal'].includes(b.class_type)) throw new HttpError(400, 'Modalidad inválida');
  const sessions = Number(b.sessions);
  const months = Number(b.duration_months) || 1;
  const price = Number(b.price_regular);
  if (!Number.isInteger(sessions) || sessions < 1) throw new HttpError(400, 'Número de sesiones inválido');
  if (!Number.isInteger(months) || months < 1 || months > 12) throw new HttpError(400, 'Duración inválida (1 a 12 meses)');
  if (!(price >= 0)) throw new HttpError(400, 'Precio inválido');

  const plan = await one(
    `INSERT INTO plans (code, name, class_type, sessions, duration_months, price_regular, price_founder, price_founder_bonus)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      `${b.class_type}_${sessions}_${Date.now().toString(36)}`,
      name,
      b.class_type,
      sessions,
      months,
      price,
      num(b.price_founder),
      num(b.price_founder_bonus),
    ],
  );
  res.status(201).json({ plan });
});

router.patch('/plans/:id', async (req, res) => {
  const b = req.body || {};
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const plan = await one(
    `UPDATE plans SET
       name = coalesce($2, name),
       price_regular = coalesce($3, price_regular),
       price_founder = $4,
       price_founder_bonus = $5,
       active = coalesce($6, active)
     WHERE id = $1 RETURNING *`,
    [
      Number(req.params.id),
      b.name || null,
      num(b.price_regular),
      num(b.price_founder),
      num(b.price_founder_bonus),
      b.active ?? null,
    ],
  );
  if (!plan) throw new HttpError(404, 'Plan no encontrado');
  res.json({ plan });
});

export default router;
