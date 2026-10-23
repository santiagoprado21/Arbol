import { TODAY, TZ } from './db.js';
import { HttpError } from './auth.js';

export const BOOKING_HORIZON_DAYS = 14;
export const FOUNDER_BOOKING_HORIZON_DAYS = 21;
export const EVALUATION_PRICE = 50000;
// The founder monthly bonus survives only if each new plan starts within this many days of the previous one ending.
export const BONUS_GRACE_DAYS = 5;
// Limits per session plan (not per year). Clients self-serve within these; the admin can go beyond them.
export const FREEZE_POLICY = {
  regular: { maxFreezes: 1, maxDays: 7 },
  founder: { maxFreezes: 2, maxDays: 21 },
};

export const PRICE_TIERS = ['regular', 'founder', 'founder_bonus', 'membership'];

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// SQL expression: end date of the user's annual membership covering today, or NULL. `typeSql` is a SQL expression
// for the membership type: the default only counts the full Founder membership.
export const founderUntilSql = (userCol, typeSql = `'founder'`) => `(
  SELECT max(fm.end_date) FROM memberships fm JOIN plans fp ON fp.id = fm.plan_id
  WHERE fm.user_id = ${userCol} AND fp.class_type = 'membership' AND fp.membership_type = ${typeSql}
    AND ${TODAY} BETWEEN fm.start_date AND fm.end_date)`;

// Founder Lite: founder rates without the monthly bonus, plus flexible freezes. No priority, Founders Only or guest.
export async function memberStatus(db, userId, onDate = null) {
  const { rows: [s] } = await db.query(
    `SELECT u.client_type, u.founder_bonus_active, u.invited_by, h.full_name AS invited_by_name,
            fm.start_date AS founder_since, fm.end_date AS founder_until
     FROM users u
     LEFT JOIN users h ON h.id = u.invited_by
     LEFT JOIN LATERAL (
       SELECT m.start_date, m.end_date FROM memberships m JOIN plans p ON p.id = m.plan_id
       WHERE m.user_id = u.id AND p.class_type = 'membership' AND p.membership_type = u.client_type
         AND coalesce($2::date, ${TODAY}) BETWEEN m.start_date AND m.end_date
       ORDER BY m.end_date DESC LIMIT 1
     ) fm ON true
     WHERE u.id = $1`,
    [userId, isDate(onDate) ? onDate : null],
  );
  if (!s) throw new HttpError(404, 'Cliente no encontrado');
  const founder = s.client_type === 'founder' && s.founder_until != null;
  const founderLite = s.client_type === 'founder_lite' && s.founder_until != null;
  return {
    client_type: s.client_type,
    founder,
    founder_lite: founderLite,
    founder_since: s.founder_since,
    founder_until: s.founder_until,
    founder_rates: founder || founderLite || s.client_type === 'founder_guest',
    bonus_active: founder && s.founder_bonus_active,
    invited_by: s.invited_by,
    invited_by_name: s.invited_by_name,
    booking_horizon_days: founder ? FOUNDER_BOOKING_HORIZON_DAYS : BOOKING_HORIZON_DAYS,
    freeze_policy: FREEZE_POLICY[founder || founderLite ? 'founder' : 'regular'],
  };
}

export async function creditableEvaluation(db, userId) {
  const { rows: [e] } = await db.query(
    `SELECT e.id, e.amount FROM evaluations e JOIN reservations r ON r.id = e.reservation_id
     WHERE e.user_id = $1 AND e.payment_status = 'paid' AND e.credited_membership_id IS NULL
       AND r.status <> 'cancelled'
     ORDER BY e.id LIMIT 1`,
    [userId],
  );
  return e || null;
}

async function keepsBonus(db, userId, startDate, founderSince) {
  const { rows: [r] } = await db.query(
    `SELECT max(m.end_date) AS prev_end FROM memberships m JOIN plans p ON p.id = m.plan_id
     WHERE m.user_id = $1 AND p.class_type <> 'membership' AND m.start_date < $2::date`,
    [userId, startDate],
  );
  if (!r.prev_end || r.prev_end < founderSince) return true;
  const { rows: [c] } = await db.query(`SELECT $1::date >= ($2::date - 1 - $3::int) AS ok`, [
    r.prev_end,
    startDate,
    BONUS_GRACE_DAYS,
  ]);
  return c.ok;
}

// Suggested price for activating `plan` for a user, starting on `startDate` (YYYY-MM-DD).
export async function quotePlan(db, userId, plan, startDate) {
  if (plan.class_type === 'membership') {
    return { tier: 'membership', base: plan.price_regular, credit: 0, amount: plan.price_regular, evaluation_id: null, loses_bonus: false };
  }
  const status = await memberStatus(db, userId, startDate);
  let tier = status.founder_rates ? 'founder' : 'regular';
  let losesBonus = false;
  if (status.bonus_active) {
    if (await keepsBonus(db, userId, startDate, status.founder_since)) tier = 'founder_bonus';
    else losesBonus = true;
  }
  const base =
    tier === 'founder_bonus'
      ? plan.price_founder_bonus ?? plan.price_founder ?? plan.price_regular
      : tier === 'founder'
        ? plan.price_founder ?? plan.price_regular
        : plan.price_regular;
  const evaluation = await creditableEvaluation(db, userId);
  const credit = evaluation ? Math.min(evaluation.amount, base) : 0;
  return { tier, base, credit, amount: base - credit, evaluation_id: evaluation?.id ?? null, loses_bonus: losesBonus };
}

export async function membershipFreezes(db, membershipIds) {
  if (membershipIds.length === 0) return {};
  const { rows } = await db.query(
    `SELECT id, membership_id, start_date, end_date, reason, created_by_admin,
            (end_date - start_date + 1)::int AS days
     FROM membership_freezes WHERE membership_id = ANY($1::int[]) ORDER BY start_date`,
    [membershipIds],
  );
  const byMembership = {};
  for (const f of rows) (byMembership[f.membership_id] ||= []).push(f);
  return byMembership;
}

export async function freezeMembership(db, membershipId, { startDate, days, reason, userId = null }) {
  const asAdmin = userId == null;
  const { rows: [m] } = await db.query(
    `SELECT m.*, p.class_type, ${TODAY}::text AS today FROM memberships m JOIN plans p ON p.id = m.plan_id
     WHERE m.id = $1 FOR UPDATE OF m`,
    [membershipId],
  );
  if (!m || (!asAdmin && m.user_id !== userId)) throw new HttpError(404, 'Plan no encontrado');
  if (m.class_type === 'membership') throw new HttpError(400, 'La membresía anual Founder no se congela');

  days = Number(days);
  if (!isDate(startDate) || !Number.isInteger(days) || days < 1 || days > 60) {
    throw new HttpError(400, 'Indica una fecha de inicio y un número de días válido');
  }
  if (startDate < m.start_date || startDate > m.end_date) {
    throw new HttpError(400, 'El congelamiento debe empezar dentro de la vigencia del plan');
  }
  if (!asAdmin && startDate <= m.today) throw new HttpError(400, 'El congelamiento debe empezar a partir de mañana');

  const { rows: [used] } = await db.query(
    `SELECT count(*)::int AS n, coalesce(sum(end_date - start_date + 1), 0)::int AS days,
            bool_or(start_date <= ($2::date + $3::int - 1) AND end_date >= $2::date) AS overlaps
     FROM membership_freezes WHERE membership_id = $1`,
    [m.id, startDate, days],
  );
  if (used.overlaps) throw new HttpError(409, 'Ya hay un congelamiento en esas fechas');
  if (!asAdmin) {
    const { freeze_policy: policy } = await memberStatus(db, m.user_id);
    if (used.n >= policy.maxFreezes) {
      throw new HttpError(403, `Tu plan permite ${policy.maxFreezes} congelamiento(s) y ya los usaste`);
    }
    if (used.days + days > policy.maxDays) {
      throw new HttpError(403, `Te quedan ${policy.maxDays - used.days} días de congelamiento en este plan`);
    }
  }

  const { rows: [freeze] } = await db.query(
    `INSERT INTO membership_freezes (membership_id, start_date, end_date, reason, created_by_admin)
     VALUES ($1, $2::date, $2::date + $3::int - 1, $4, $5) RETURNING *`,
    [m.id, startDate, days, reason || null, asAdmin],
  );
  await db.query(`UPDATE memberships SET end_date = end_date + $2::int WHERE id = $1`, [m.id, days]);
  const { rows: cancelled } = await db.query(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = now()
     WHERE membership_id = $1 AND status = 'booked' AND slot_id IN (
       SELECT id FROM class_slots WHERE (starts_at AT TIME ZONE '${TZ}')::date BETWEEN $2 AND $3)
     RETURNING id`,
    [m.id, freeze.start_date, freeze.end_date],
  );
  return { freeze, cancelled: cancelled.length };
}

export async function removeFreeze(db, freezeId) {
  const { rows: [f] } = await db.query(
    `DELETE FROM membership_freezes WHERE id = $1 RETURNING membership_id, (end_date - start_date + 1)::int AS days`,
    [freezeId],
  );
  if (!f) throw new HttpError(404, 'Congelamiento no encontrado');
  await db.query(
    `UPDATE memberships SET end_date = greatest(start_date, end_date - $2::int) WHERE id = $1`,
    [f.membership_id, f.days],
  );
}
