import { query, tx, TZ } from './db.js';

const SEMI_SCHEDULE_2026_10 = {
  weekdays: [2, 4, 5],
  times: ['07:00', '12:15', '17:30', '18:30'],
};

// Each migration runs exactly once per database, in order. Never edit one that already shipped; add a new one.
const MIGRATIONS = [
  {
    id: '2026-10-12-essential-to-founder',
    run: async (db) => {
      await db.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'plans' AND column_name = 'price_essential') THEN
            ALTER TABLE plans RENAME COLUMN price_essential TO price_founder;
          END IF;
        END $$`);
      await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_client_type_check`);
      await db.query(`UPDATE users SET client_type = 'founder' WHERE client_type = 'essential'`);
      await db.query(
        `ALTER TABLE users ADD CONSTRAINT users_client_type_check CHECK (client_type IN ('regular', 'founder'))`,
      );
    },
  },
  {
    id: '2026-10-12-schedule-tue-thu-fri-v2',
    run: async (db) => {
      await db.query(`UPDATE schedule_templates SET active = false`);
      const outdated = `
        SELECT s.id FROM class_slots s
        WHERE s.starts_at >= current_date::timestamp AT TIME ZONE '${TZ}'
          AND NOT (s.class_type = 'semi'
                   AND extract(dow FROM s.starts_at AT TIME ZONE '${TZ}')::int = ANY($1::int[])
                   AND to_char(s.starts_at AT TIME ZONE '${TZ}', 'HH24:MI') = ANY($2::text[]))`;
      const params = [SEMI_SCHEDULE_2026_10.weekdays, SEMI_SCHEDULE_2026_10.times];
      await db.query(
        `UPDATE reservations SET status = 'cancelled', cancelled_at = now()
         WHERE status = 'booked' AND slot_id IN (${outdated} AND s.starts_at > now())`,
        params,
      );
      await db.query(
        `DELETE FROM class_slots WHERE id IN (${outdated})
           AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.slot_id = class_slots.id AND r.status <> 'cancelled')`,
        params,
      );
      await db.query(
        `UPDATE class_slots SET status = 'cancelled' WHERE id IN (${outdated} AND s.starts_at > now())`,
        params,
      );
      for (const weekday of SEMI_SCHEDULE_2026_10.weekdays) {
        for (const time of SEMI_SCHEDULE_2026_10.times) {
          await db.query(
            `INSERT INTO schedule_templates (weekday, start_time, duration_min, class_type, capacity)
             VALUES ($1, $2, 60, 'semi', 6)
             ON CONFLICT (weekday, start_time, class_type)
             DO UPDATE SET active = true, duration_min = 60, capacity = 6`,
            [weekday, time],
          );
        }
      }
    },
  },
  {
    id: '2026-10-13-flex-founder-membership-freezes-evaluations',
    run: async (db) => {
      await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_client_type_check`);
      await db.query(
        `ALTER TABLE users ADD CONSTRAINT users_client_type_check
           CHECK (client_type IN ('regular', 'founder', 'founder_guest'))`,
      );
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS founder_bonus_active BOOLEAN NOT NULL DEFAULT true`);
      await db.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_one_guest_per_founder ON users(invited_by) WHERE invited_by IS NOT NULL`,
      );

      await db.query(`ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_class_type_check`);
      await db.query(
        `ALTER TABLE plans ADD CONSTRAINT plans_class_type_check CHECK (class_type IN ('personal', 'semi', 'membership'))`,
      );
      await db.query(`ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_sessions_check`);
      await db.query(`ALTER TABLE plans ADD CONSTRAINT plans_sessions_check CHECK (sessions >= 0)`);
      await db.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1`);
      await db.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_founder_bonus INTEGER`);
      await db.query(`UPDATE plans SET name = replace(name, 'Semi-personalizado', 'FLEX') WHERE class_type = 'semi'`);
      await db.query(`UPDATE plans SET active = false WHERE code = 'semi_4'`);

      await db.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS price_tier TEXT`);
      await db.query(`ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS founders_only BOOLEAN NOT NULL DEFAULT false`);
      await db.query(`ALTER TABLE class_slots ADD COLUMN IF NOT EXISTS founders_only BOOLEAN NOT NULL DEFAULT false`);
    },
  },
];

export async function runMigrations() {
  await query(`CREATE TABLE IF NOT EXISTS app_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await query('SELECT id FROM app_migrations');
  const applied = new Set(rows.map((r) => r.id));

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await tx(async (db) => {
      await m.run(db);
      await db.query('INSERT INTO app_migrations (id) VALUES ($1)', [m.id]);
    });
    console.log(`[migrations] Aplicada: ${m.id}`);
  }
}
