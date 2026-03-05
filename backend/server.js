// ============================================================
//  Wonder Worlds — Backend API  (server.js)
//  Node.js + Express + PostgreSQL
//  Version: 4.0 — Production Ready
// ============================================================
'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { Pool }   = require('pg');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
require('dotenv').config();

// ── Optional Stripe (skip if key not set) ───────────────────
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const app = express();

// ── Database Pool ───────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

db.connect()
  .then(() => console.log('✅ Database connected'))
  .catch(e => { console.error('❌ Database connection failed:', e.message); process.exit(1); });

// ── Security Middleware ─────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false   // let frontend handle its own CSP
}));
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true
}));

// Raw body for Stripe webhooks (must be before express.json)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// ── Rate Limiting ───────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 15, message: { error: 'Too many login attempts — try again in 15 minutes' } }));

// ── Auth Middleware ─────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch(e) {
    res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Session expired — please log in again' : 'Invalid token' });
  }
}

// Optional auth — attaches user if token provided, doesn't fail if not
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try { req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); } catch {}
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are all required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email address' });

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length) return res.status(409).json({ error: 'This email is already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, plan, created_at)
       VALUES ($1,$2,$3,'player','free',NOW()) RETURNING id,name,email,role,plan`,
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    const user = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch(e) { console.error('Register error:', e); res.status(500).json({ error: 'Registration failed' }); }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await db.query(
      'SELECT * FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    if (!await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = signToken(user);
    res.json({ token, user: safeUser(user) });
  } catch(e) { console.error('Login error:', e); res.status(500).json({ error: 'Login failed' }); }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id,name,email,role,plan,avatar_url,created_at FROM users WHERE id=$1', [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not fetch user' }); }
});

// ════════════════════════════════════════════════════════════
//  WORLDS — Public read, Admin write
// ════════════════════════════════════════════════════════════

// GET /api/worlds  — returns all active worlds with question counts
// Works without auth (free worlds shown open, premium worlds shown locked)
app.get('/api/worlds', optionalAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM questions q WHERE q.world_id=w.id AND q.is_active=true) AS question_count
      FROM worlds w
      WHERE w.is_active=true
      ORDER BY w.sort_order, w.id`);

    const isPremium = ['premium','school'].includes(req.user?.plan);
    const data = rows.map(w => ({
      ...w,
      locked: !isPremium && w.requires_premium
    }));
    res.json(data);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Could not load worlds' }); }
});

// GET /api/worlds/:id  — single world detail
app.get('/api/worlds/:id', optionalAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM worlds WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'World not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not load world' }); }
});

// ════════════════════════════════════════════════════════════
//  QUESTIONS — Public read with auth check, Admin write
// ════════════════════════════════════════════════════════════

// GET /api/questions/:worldId/:difficulty?count=5&exclude=1,2,3
app.get('/api/questions/:worldId/:difficulty', optionalAuth, async (req, res) => {
  try {
    const { worldId, difficulty } = req.params;
    const count   = Math.min(parseInt(req.query.count) || 5, 20);
    const exclude = req.query.exclude ? req.query.exclude.split(',').map(Number).filter(n => !isNaN(n)) : [];

    // Check world exists & access
    const world = await db.query('SELECT * FROM worlds WHERE id=$1 AND is_active=true', [worldId]);
    if (!world.rows.length) return res.status(404).json({ error: 'World not found' });

    const isPremium = ['premium','school'].includes(req.user?.plan);
    if (world.rows[0].requires_premium && !isPremium) {
      return res.status(402).json({ error: 'Premium subscription required', requiredPlan: 'premium' });
    }

    const validDifficulties = ['easy','medium','hard','expert'];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty. Use: easy, medium, hard, expert' });
    }

    let sql = `SELECT id,question_text,options,correct_index,hint,passage,difficulty
               FROM questions
               WHERE world_id=$1 AND difficulty=$2 AND is_active=true`;
    const params = [worldId, difficulty];

    if (exclude.length) {
      sql += ` AND id != ALL($${params.length+1}::int[])`;
      params.push(exclude);
    }
    sql += ` ORDER BY RANDOM() LIMIT $${params.length+1}`;
    params.push(count);

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Could not load questions' }); }
});

// GET /api/questions  — admin: paginated list with filters
app.get('/api/questions', authenticate, adminOnly, async (req, res) => {
  try {
    const { worldId='', difficulty='', search='', page=1, limit=50 } = req.query;
    const offset = (parseInt(page)-1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (worldId)    { params.push(worldId);    where += ` AND q.world_id=$${params.length}`; }
    if (difficulty) { params.push(difficulty); where += ` AND q.difficulty=$${params.length}`; }
    if (search)     { params.push(`%${search}%`); where += ` AND q.question_text ILIKE $${params.length}`; }

    const sql = `SELECT q.*,w.name AS world_name
                 FROM questions q JOIN worlds w ON w.id=q.world_id
                 ${where} ORDER BY q.created_at DESC
                 LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), offset);

    const [questions, total] = await Promise.all([
      db.query(sql, params),
      db.query(`SELECT COUNT(*) FROM questions q ${where}`, params.slice(0, -2))
    ]);
    res.json({ questions: questions.rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Could not fetch questions' }); }
});

// POST /api/questions  — create
app.post('/api/questions', authenticate, adminOnly, async (req, res) => {
  try {
    const { worldId, questionText, options, correctIndex, difficulty='easy', hint='', passage='' } = req.body;
    if (!worldId || !questionText?.trim()) return res.status(400).json({ error: 'worldId and questionText required' });
    if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least 2 options required' });
    if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= options.length) {
      return res.status(400).json({ error: 'correctIndex must point to a valid option' });
    }
    const { rows } = await db.query(
      `INSERT INTO questions (world_id,question_text,options,correct_index,difficulty,hint,passage,is_active,created_by,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,NOW()) RETURNING *`,
      [worldId, questionText.trim(), JSON.stringify(options), correctIndex, difficulty, hint, passage, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Could not create question' }); }
});

// PATCH /api/questions/:id  — update
app.patch('/api/questions/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { questionText, options, correctIndex, difficulty, hint, passage, isActive } = req.body;
    const { rows } = await db.query(
      `UPDATE questions SET
         question_text=COALESCE($1,question_text),
         options=COALESCE($2,options),
         correct_index=COALESCE($3,correct_index),
         difficulty=COALESCE($4,difficulty),
         hint=COALESCE($5,hint),
         passage=COALESCE($6,passage),
         is_active=COALESCE($7,is_active),
         updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [questionText||null, options?JSON.stringify(options):null, correctIndex??null,
       difficulty||null, hint??null, passage??null, isActive??null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not update question' }); }
});

// DELETE /api/questions/:id  — soft delete (is_active=false)
app.delete('/api/questions/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE questions SET is_active=false,updated_at=NOW() WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });
    res.json({ deleted: true, id: rows[0].id });
  } catch(e) { res.status(500).json({ error: 'Could not delete question' }); }
});

// POST /api/questions/bulk  — import many questions
app.post('/api/questions/bulk', authenticate, adminOnly, async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ error: 'Provide an array of questions' });
    }
    let imported = 0; const errors = [];
    for (const [i, q] of questions.entries()) {
      if (!q.world_id || !q.question_text || !Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Row ${i+1}: missing world_id, question_text, or options`); continue;
      }
      await db.query(
        `INSERT INTO questions (world_id,question_text,options,correct_index,difficulty,hint,passage,is_active,created_by,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,NOW())`,
        [q.world_id, q.question_text, JSON.stringify(q.options),
         q.correct_index||0, q.difficulty||'easy', q.hint||'', q.passage||'', req.user.id]
      );
      imported++;
    }
    res.json({ imported, errors, total: questions.length });
  } catch(e) { res.status(500).json({ error: 'Bulk import failed' }); }
});

// ════════════════════════════════════════════════════════════
//  ADMIN — WORLDS CRUD (Create, Read, Update, Delete)
// ════════════════════════════════════════════════════════════

// GET /api/admin/worlds
app.get('/api/admin/worlds', authenticate, adminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM questions q WHERE q.world_id=w.id AND q.is_active=true) AS question_count,
        (SELECT COUNT(*) FROM questions q WHERE q.world_id=w.id) AS total_questions
      FROM worlds w ORDER BY w.sort_order, w.id`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: 'Could not fetch worlds' }); }
});

// POST /api/admin/worlds  — create new world
app.post('/api/admin/worlds', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, emoji, description='', colorFrom='#A855F7', colorTo='#6366F1', requiresPremium=false, sortOrder=99 } = req.body;
    if (!name?.trim() || !emoji?.trim()) return res.status(400).json({ error: 'Name and emoji required' });
    const { rows } = await db.query(
      `INSERT INTO worlds (name,emoji,description,color_from,color_to,requires_premium,sort_order,is_active,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW()) RETURNING *`,
      [name.trim(), emoji.trim(), description, colorFrom, colorTo, !!requiresPremium, sortOrder]
    );
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not create world' }); }
});

// PATCH /api/admin/worlds/:id  — update world
app.patch('/api/admin/worlds/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, emoji, description, colorFrom, colorTo, requiresPremium, isActive, sortOrder } = req.body;
    const { rows } = await db.query(
      `UPDATE worlds SET
         name=COALESCE($1,name), emoji=COALESCE($2,emoji), description=COALESCE($3,description),
         color_from=COALESCE($4,color_from), color_to=COALESCE($5,color_to),
         requires_premium=COALESCE($6,requires_premium), is_active=COALESCE($7,is_active),
         sort_order=COALESCE($8,sort_order), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name||null, emoji||null, description??null, colorFrom||null, colorTo||null,
       requiresPremium??null, isActive??null, sortOrder??null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'World not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not update world' }); }
});

// DELETE /api/admin/worlds/:id  — HARD DELETE world + all its questions
// This is the fix for "worlds not deleting" — previous version only soft-deleted
app.delete('/api/admin/worlds/:id', authenticate, adminOnly, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const world = await client.query('SELECT * FROM worlds WHERE id=$1', [req.params.id]);
    if (!world.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'World not found' });
    }
    // Delete all session answers for questions in this world
    await client.query(`
      DELETE FROM session_answers WHERE question_id IN
        (SELECT id FROM questions WHERE world_id=$1)`, [req.params.id]);
    // Delete all questions in this world
    const deletedQ = await client.query(
      'DELETE FROM questions WHERE world_id=$1 RETURNING id', [req.params.id]
    );
    // Delete leaderboard entries for this world
    await client.query('DELETE FROM leaderboard WHERE world_id=$1', [req.params.id]);
    // Delete game sessions for this world
    await client.query('DELETE FROM game_sessions WHERE world_id=$1', [req.params.id]);
    // Finally delete the world itself
    await client.query('DELETE FROM worlds WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({
      deleted: true,
      worldName: world.rows[0].name,
      questionsDeleted: deletedQ.rows.length
    });
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Delete world error:', e);
    res.status(500).json({ error: 'Could not delete world — transaction rolled back' });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
//  ADMIN — USERS
// ════════════════════════════════════════════════════════════

app.get('/api/admin/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { page=1, limit=50, search='', plan='' } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (search) { params.push(`%${search}%`); where += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`; }
    if (plan)   { params.push(plan); where += ` AND u.plan=$${params.length}`; }
    params.push(parseInt(limit), offset);
    const { rows } = await db.query(
      `SELECT u.id,u.name,u.email,u.role,u.plan,u.is_active,u.created_at,u.last_login,
         (SELECT COUNT(*) FROM game_sessions gs WHERE gs.user_id=u.id) AS total_games
       FROM users u ${where} ORDER BY u.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    const total = await db.query(`SELECT COUNT(*) FROM users u ${where}`, params.slice(0,-2));
    res.json({ users: rows, total: parseInt(total.rows[0].count) });
  } catch(e) { res.status(500).json({ error: 'Could not fetch users' }); }
});

app.patch('/api/admin/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { role, plan, isActive } = req.body;
    const updates = []; const params = [];
    if (role     !== undefined) { params.push(role);     updates.push(`role=$${params.length}`); }
    if (plan     !== undefined) { params.push(plan);     updates.push(`plan=$${params.length}`); }
    if (isActive !== undefined) { params.push(isActive); updates.push(`is_active=$${params.length}`); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${params.length} RETURNING id,name,email,role,plan,is_active`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Could not update user' }); }
});

app.delete('/api/admin/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    if (req.params.id == req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.query('UPDATE users SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { res.status(500).json({ error: 'Could not delete user' }); }
});

app.post('/api/admin/promote', authenticate, adminOnly, async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await db.query(
      "UPDATE users SET role='admin' WHERE email=$1 RETURNING id,name,email,role", [email?.toLowerCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ promoted: true, user: rows[0] });
  } catch(e) { res.status(500).json({ error: 'Could not promote user' }); }
});

// ════════════════════════════════════════════════════════════
//  GAME SESSIONS & LEADERBOARD
// ════════════════════════════════════════════════════════════

// POST /api/sessions/save  — save game result (no auth required — kids play without login)
app.post('/api/sessions/save', optionalAuth, async (req, res) => {
  try {
    const { playerName, playerAvatar, worldId, difficulty, level, score, stars, totalQuestions, correctAnswers } = req.body;
    if (!worldId || score === undefined) return res.status(400).json({ error: 'worldId and score required' });

    const userId = req.user?.id || null;
    const { rows } = await db.query(
      `INSERT INTO game_sessions (user_id,player_name,world_id,difficulty,level,score,stars,total_questions,correct_answers,played_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id`,
      [userId, playerName||'Guest', worldId, difficulty, level, score, stars||0, totalQuestions||0, correctAnswers||0]
    );
    // Upsert leaderboard
    await db.query(`
      INSERT INTO leaderboard (user_id,player_name,world_id,best_score,total_stars,games_played,updated_at)
      VALUES ($1,$2,$3,$4,$5,1,NOW())
      ON CONFLICT (COALESCE(user_id,0),world_id)
      DO UPDATE SET
        best_score=GREATEST(leaderboard.best_score,$4),
        total_stars=leaderboard.total_stars+$5,
        games_played=leaderboard.games_played+1,
        player_name=COALESCE(EXCLUDED.player_name,leaderboard.player_name),
        updated_at=NOW()`,
      [userId, playerName||'Guest', worldId, score, stars||0]);
    res.json({ saved: true, sessionId: rows[0].id });
  } catch(e) { console.error('Save session error:', e); res.status(500).json({ error: 'Could not save session' }); }
});

// GET /api/leaderboard?worldId=&limit=20
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { worldId, limit=20 } = req.query;
    const params = [parseInt(limit)];
    let where = '';
    if (worldId) { params.unshift(worldId); where = 'WHERE lb.world_id=$1'; params[params.length-1] = parseInt(limit); }
    const sql = `
      SELECT lb.player_name,lb.best_score,lb.total_stars,lb.games_played,
        w.name AS world_name, w.emoji,
        u.avatar_url
      FROM leaderboard lb
      JOIN worlds w ON w.id=lb.world_id
      LEFT JOIN users u ON u.id=lb.user_id
      ${where}
      ORDER BY lb.best_score DESC LIMIT $${params.length}`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: 'Could not load leaderboard' }); }
});

// ════════════════════════════════════════════════════════════
//  ADMIN — ANALYTICS
// ════════════════════════════════════════════════════════════

app.get('/api/admin/analytics', authenticate, adminOnly, async (req, res) => {
  try {
    const [users, sessions, topWorlds, recent] = await Promise.all([
      db.query(`SELECT
        COUNT(*) total,
        COUNT(*) FILTER (WHERE plan='premium') premium,
        COUNT(*) FILTER (WHERE plan='school') school,
        COUNT(*) FILTER (WHERE plan='free') free,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days') new_this_week
        FROM users WHERE is_active=true`),
      db.query(`SELECT
        COUNT(*) total_games,
        ROUND(AVG(score),0) avg_score,
        SUM(stars) total_stars,
        COUNT(*) FILTER (WHERE played_at > NOW()-INTERVAL '30 days') games_30d
        FROM game_sessions`),
      db.query(`SELECT w.name,w.emoji,COUNT(*) plays
        FROM game_sessions gs JOIN worlds w ON w.id=gs.world_id
        GROUP BY w.id,w.name,w.emoji ORDER BY plays DESC LIMIT 6`),
      db.query(`SELECT DATE(played_at) day, COUNT(*) games
        FROM game_sessions WHERE played_at > NOW()-INTERVAL '14 days'
        GROUP BY day ORDER BY day`)
    ]);
    res.json({
      users: users.rows[0],
      sessions: sessions.rows[0],
      topWorlds: topWorlds.rows,
      recentActivity: recent.rows
    });
  } catch(e) { res.status(500).json({ error: 'Analytics failed' }); }
});

// ════════════════════════════════════════════════════════════
//  STRIPE BILLING (optional — only active if keys set)
// ════════════════════════════════════════════════════════════

app.post('/api/billing/checkout', authenticate, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
  try {
    const { plan } = req.body;
    const PLANS = {
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
      school:  process.env.STRIPE_SCHOOL_PRICE_ID
    };
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{ price: PLANS[plan], quantity: 1 }],
      metadata: { userId: String(req.user.id), plan },
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
      cancel_url:  `${process.env.FRONTEND_URL}/pricing`,
    });
    res.json({ url: session.url });
  } catch(e) { res.status(500).json({ error: 'Checkout failed' }); }
});

app.post('/api/billing/webhook', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
  try {
    const event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    );
    if (event.type === 'checkout.session.completed') {
      const { userId, plan } = event.data.object.metadata;
      await db.query('UPDATE users SET plan=$1,stripe_customer_id=$2 WHERE id=$3',
        [plan, event.data.object.customer, userId]);
    }
    if (event.type === 'customer.subscription.deleted') {
      await db.query('UPDATE users SET plan=$1 WHERE stripe_customer_id=$2',
        ['free', event.data.object.customer]);
    }
    res.json({ received: true });
  } catch(e) { res.status(400).json({ error: 'Webhook error: ' + e.message }); }
});

// ════════════════════════════════════════════════════════════
//  UTILITY
// ════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', version: '4.0', ts: new Date().toISOString() }));

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan };
}

// ── 404 & Error handlers ────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`✅ Wonder Worlds API v4.0 running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database:    ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') || 'not set'}`);
  console.log(`   Stripe:      ${stripe ? 'configured' : 'not configured (payments disabled)'}`);
});
