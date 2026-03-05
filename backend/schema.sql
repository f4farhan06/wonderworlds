-- ============================================================
--  Wonder Worlds — PostgreSQL Schema v4.0
--  Run:  psql %DATABASE_URL% -f schema.sql   (Windows)
--        psql $DATABASE_URL -f schema.sql    (Mac/Linux)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  role              VARCHAR(20)  NOT NULL DEFAULT 'player'
                    CHECK (role IN ('player','teacher','admin')),
  plan              VARCHAR(20)  NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free','premium','school')),
  avatar_url        TEXT,
  stripe_customer_id TEXT UNIQUE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan   ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ── Worlds ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worlds (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  emoji             VARCHAR(10)  NOT NULL,
  description       TEXT         NOT NULL DEFAULT '',
  color_from        VARCHAR(20)  NOT NULL DEFAULT '#A855F7',
  color_to          VARCHAR(20)  NOT NULL DEFAULT '#6366F1',
  requires_premium  BOOLEAN      NOT NULL DEFAULT false,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  sort_order        INTEGER      NOT NULL DEFAULT 99,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worlds_active ON worlds(is_active);
CREATE INDEX IF NOT EXISTS idx_worlds_sort   ON worlds(sort_order);

-- ── Questions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                SERIAL PRIMARY KEY,
  world_id          INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  question_text     TEXT    NOT NULL,
  options           JSONB   NOT NULL,          -- ["Option A","Option B","Option C","Option D"]
  correct_index     INTEGER NOT NULL CHECK (correct_index >= 0),
  difficulty        VARCHAR(20) NOT NULL DEFAULT 'easy'
                    CHECK (difficulty IN ('easy','medium','hard','expert')),
  hint              TEXT    NOT NULL DEFAULT '',
  passage           TEXT    NOT NULL DEFAULT '', -- reading comprehension passage
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_world      ON questions(world_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active     ON questions(is_active);

-- ── Game Sessions ────────────────────────────────────────────
-- user_id is nullable — kids play without logging in
CREATE TABLE IF NOT EXISTS game_sessions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  player_name       VARCHAR(100) NOT NULL DEFAULT 'Guest',
  world_id          INTEGER REFERENCES worlds(id) ON DELETE SET NULL,
  difficulty        VARCHAR(20),
  level             INTEGER,
  score             INTEGER      NOT NULL DEFAULT 0,
  stars             INTEGER      NOT NULL DEFAULT 0,
  total_questions   INTEGER      NOT NULL DEFAULT 0,
  correct_answers   INTEGER      NOT NULL DEFAULT 0,
  played_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world   ON game_sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date    ON game_sessions(played_at);

-- ── Session Answers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_answers (
  id                SERIAL PRIMARY KEY,
  session_id        INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_id       INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  chosen_index      INTEGER,   -- -1 = timed out
  is_correct        BOOLEAN    NOT NULL DEFAULT false,
  time_taken_ms     INTEGER    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sa_session ON session_answers(session_id);

-- ── Leaderboard ──────────────────────────────────────────────
-- user_id nullable (guest players tracked by name only)
CREATE TABLE IF NOT EXISTS leaderboard (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_name       VARCHAR(100) NOT NULL DEFAULT 'Guest',
  world_id          INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  best_score        INTEGER NOT NULL DEFAULT 0,
  total_stars       INTEGER NOT NULL DEFAULT 0,
  games_played      INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (user_id, world_id)
);
CREATE INDEX IF NOT EXISTS idx_lb_score   ON leaderboard(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_lb_world   ON leaderboard(world_id);

-- ── Plans Reference ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(20) UNIQUE NOT NULL,
  name            VARCHAR(100),
  price_monthly   DECIMAL(8,2),
  stripe_price_id TEXT,
  features        JSONB
);
INSERT INTO plans (key,name,price_monthly,features) VALUES
  ('free',    'Free',    0.00, '{"worlds":3,"levels":3}'),
  ('premium', 'Premium', 6.99, '{"worlds":"all","levels":"all","review":true}'),
  ('school',  'School', 29.99, '{"worlds":"all","levels":"all","review":true,"classManagement":true}')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
--  SEED: Default Worlds
-- ────────────────────────────────────────────────────────────
INSERT INTO worlds (name,emoji,description,color_from,color_to,requires_premium,sort_order) VALUES
  ('Math World',       '🔢','Numbers, algebra, geometry and more','#FF6B6B','#FF8E53',false,1),
  ('Science Lab',      '🔬','Biology, chemistry, physics and beyond','#4ECDC4','#44A08D',false,2),
  ('Quiz Zone',        '🧩','Fun trivia across every topic','#A855F7','#6366F1',false,3),
  ('General Knowledge','🌐','Geography, history and world facts','#F59E0B','#EF4444',true,4),
  ('Reading Quest',    '📚','Comprehension passages for all levels','#3B82F6','#06B6D4',true,5),
  ('Writing Studio',   '✏️','Grammar, vocabulary and literary devices','#10B981','#84CC16',true,6)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
--  SEED: Admin User
--  Password: Admin@1234  — CHANGE THIS IN PRODUCTION
-- ────────────────────────────────────────────────────────────
INSERT INTO users (name,email,password_hash,role,plan) VALUES (
  'Admin',
  'admin@wonderworlds.com',
  '$2a$12$eImiTXuWVxfM37uY4JANjOe5XdRGXtvSINjl3M5R.D/BKEvM9JWTO',
  'admin',
  'school'
) ON CONFLICT (email) DO NOTHING;

-- ────────────────────────────────────────────────────────────
--  USEFUL VIEWS
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_question_stats AS
SELECT
  q.id, q.question_text, q.difficulty, w.name AS world_name,
  COUNT(sa.id)                                           AS times_asked,
  ROUND(AVG(CASE WHEN sa.is_correct THEN 1.0 ELSE 0 END)*100,1) AS correct_pct,
  ROUND(AVG(sa.time_taken_ms)/1000.0,1)                AS avg_time_secs
FROM questions q
JOIN worlds w ON w.id=q.world_id
LEFT JOIN session_answers sa ON sa.question_id=q.id
WHERE q.is_active=true
GROUP BY q.id,q.question_text,q.difficulty,w.name;

CREATE OR REPLACE VIEW v_daily_stats AS
SELECT
  DATE(played_at) AS day,
  COUNT(*) AS games_played,
  ROUND(AVG(score),0) AS avg_score,
  SUM(stars) AS stars_earned
FROM game_sessions
GROUP BY DATE(played_at)
ORDER BY day DESC;
