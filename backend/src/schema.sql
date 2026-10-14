CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  cedula               TEXT UNIQUE,
  phone                TEXT,
  role                 TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  client_type          TEXT NOT NULL DEFAULT 'regular' CHECK (client_type IN ('regular', 'founder', 'founder_guest')),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  invited_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  founder_bonus_active BOOLEAN NOT NULL DEFAULT true,
  medical_notes        TEXT,
  admin_notes          TEXT,
  accepted_terms_at    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- class_type 'membership' is the annual Founder membership: no sessions, unlocks founder benefits.
CREATE TABLE IF NOT EXISTS plans (
  id                  SERIAL PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  class_type          TEXT NOT NULL CHECK (class_type IN ('personal', 'semi', 'membership')),
  sessions            INTEGER NOT NULL CHECK (sessions >= 0),
  duration_months     INTEGER NOT NULL DEFAULT 1,
  price_regular       INTEGER NOT NULL,
  price_founder       INTEGER,
  price_founder_bonus INTEGER,
  active              BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS memberships (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           INTEGER NOT NULL REFERENCES plans(id),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  sessions_total    INTEGER NOT NULL,
  amount            INTEGER NOT NULL DEFAULT 0,
  price_tier        TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_method    TEXT,
  payment_reference TEXT,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id, end_date);

CREATE TABLE IF NOT EXISTS membership_freezes (
  id               SERIAL PRIMARY KEY,
  membership_id    INTEGER NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  reason           TEXT,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS membership_freezes_membership_idx ON membership_freezes(membership_id);

CREATE TABLE IF NOT EXISTS schedule_templates (
  id            SERIAL PRIMARY KEY,
  weekday       SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time    TEXT NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 60,
  class_type    TEXT NOT NULL CHECK (class_type IN ('personal', 'semi')),
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  founders_only BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (weekday, start_time, class_type)
);

CREATE TABLE IF NOT EXISTS class_slots (
  id            SERIAL PRIMARY KEY,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  class_type    TEXT NOT NULL CHECK (class_type IN ('personal', 'semi')),
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  founders_only BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  UNIQUE (starts_at, class_type)
);
CREATE INDEX IF NOT EXISTS class_slots_starts_idx ON class_slots(starts_at);

CREATE TABLE IF NOT EXISTS reservations (
  id            SERIAL PRIMARY KEY,
  slot_id       INTEGER NOT NULL REFERENCES class_slots(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id INTEGER REFERENCES memberships(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'booked'
                CHECK (status IN ('booked', 'cancelled', 'late_cancel', 'attended', 'no_show')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_active_unique
  ON reservations(slot_id, user_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS reservations_user_idx ON reservations(user_id);
CREATE INDEX IF NOT EXISTS reservations_membership_idx ON reservations(membership_id);

-- Paid biomechanical evaluation booked into a free 1:1 slot; its amount is credited to the next plan purchased.
CREATE TABLE IF NOT EXISTS evaluations (
  id                     SERIAL PRIMARY KEY,
  reservation_id         INTEGER NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount                 INTEGER NOT NULL,
  payment_status         TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_method         TEXT,
  paid_at                TIMESTAMPTZ,
  credited_membership_id INTEGER REFERENCES memberships(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evaluations_user_idx ON evaluations(user_id);
