import { randomBytes, randomUUID, scrypt, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SESSION_COOKIE = 'safar_rakshak_session';
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHECK_INS = 500;
const GENDERS = new Set(['Woman', 'Man', 'Non-binary', 'Self-describe', 'Prefer not to say']);
const ROLES = new Set(['Student', 'Traveler', 'Business owner', 'Employee', 'Other']);
const scryptAsync = promisify(scrypt);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  }
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      profile_ciphertext TEXT NOT NULL,
      profile_iv TEXT NOT NULL,
      profile_tag TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trip_plans (
      user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      payload_ciphertext TEXT NOT NULL,
      payload_iv TEXT NOT NULL,
      payload_tag TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      payload_ciphertext TEXT NOT NULL,
      payload_iv TEXT NOT NULL,
      payload_tag TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS check_ins_user_created
      ON check_ins(user_id, created_at);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  return db;
}

export function loadProfileKey(databasePath, isProduction = process.env.NODE_ENV === 'production') {
  const configured = process.env.PROFILE_ENCRYPTION_KEY;
  if (configured !== undefined) {
    if (!/^[\da-f]{64}$/i.test(configured)) {
      throw new Error('PROFILE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
    }
    return Buffer.from(configured, 'hex');
  }
  if (isProduction) {
    throw new Error('Set PROFILE_ENCRYPTION_KEY to a secret 32-byte hexadecimal key before starting in production.');
  }

  const keyPath = join(dirname(resolve(databasePath)), 'profile-key.bin');
  try {
    const key = readFileSync(keyPath);
    if (key.length !== 32) throw new Error('The local profile encryption key has an invalid length.');
    return key;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const key = randomBytes(32);
  mkdirSync(dirname(keyPath), { recursive: true });
  try {
    writeFileSync(keyPath, key, { flag: 'wx', mode: 0o600 });
    return key;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existingKey = readFileSync(keyPath);
    if (existingKey.length !== 32) throw new Error('The local profile encryption key has an invalid length.');
    return existingKey;
  }
}

function encryptJson(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final()
  ]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptJson(record, key, ciphertextField = 'payload_ciphertext') {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.payload_iv || record.profile_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.payload_tag || record.profile_tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record[ciphertextField], 'base64')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function safeTextEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  const tokenHash = hashSessionToken(token);
  const create = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare(`
      INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenHash, userId, csrfToken, expiresAt);
  });
  create.immediate();
  return { token, tokenHash, csrfToken, expiresAt };
}

function setSessionCookie(res, token, isProduction) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_LIFETIME_MS
  });
}

function clearSessionCookie(res, isProduction) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/'
  });
}

function getSession(db, req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return db.prepare(`
    SELECT token_hash, user_id, csrf_token, expires_at
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).get(hashSessionToken(token), Date.now()) || null;
}

function accountSummary(row, key) {
  const profile = decryptJson(row, key, 'profile_ciphertext');
  return { id: row.id, fullName: profile.fullName };
}

function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Enter valid profile details.');
  }
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
  const age = Number(body.age);
  const gender = body.gender;
  const role = body.role;

  if (!fullName || fullName.length > 80) throw new HttpError(400, 'Enter a full name of up to 80 characters.');
  if (!address || address.length > 240) throw new HttpError(400, 'Enter an address of up to 240 characters.');
  if (!isValidPhone(mobile)) throw new HttpError(400, 'Enter a valid mobile number.');
  if (!Number.isInteger(age) || age < 1 || age > 120) throw new HttpError(400, 'Enter a valid age.');
  if (!GENDERS.has(gender)) throw new HttpError(400, 'Select a valid gender option.');
  if (!ROLES.has(role)) throw new HttpError(400, 'Select a valid role.');

  return { fullName, address, mobile, age, gender, role };
}

function isValidPhone(value) {
  const digitCount = value.replace(/\D/g, '').length;
  return /^[+()0-9\s.-]{7,24}$/.test(value) && digitCount >= 7 && digitCount <= 15;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'Use a password between 12 and 128 characters.');
  }
  return password;
}

function isValidDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validatePlan(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Enter valid trip details.');
  }
  const plan = {
    destination: typeof body.destination === 'string' ? body.destination.trim() : '',
    departDate: typeof body.departDate === 'string' ? body.departDate : '',
    returnDate: typeof body.returnDate === 'string' ? body.returnDate : '',
    contactName: typeof body.contactName === 'string' ? body.contactName.trim() : '',
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '',
    itinerary: typeof body.itinerary === 'string' ? body.itinerary.trim() : ''
  };

  if (!plan.destination || plan.destination.length > 80) throw new HttpError(400, 'Enter a destination of up to 80 characters.');
  if (!isValidDate(plan.departDate) || !isValidDate(plan.returnDate)) throw new HttpError(400, 'Enter valid trip dates.');
  if (plan.departDate && plan.returnDate && plan.returnDate < plan.departDate) {
    throw new HttpError(400, 'Return date must be the same as or later than departure.');
  }
  if (plan.contactName.length > 60) throw new HttpError(400, 'Trusted contact name is too long.');
  if (Boolean(plan.contactName) !== Boolean(plan.contactPhone)) {
    throw new HttpError(400, 'Enter both trusted contact fields, or leave both blank.');
  }
  if (plan.contactPhone && !isValidPhone(plan.contactPhone)) {
    throw new HttpError(400, 'Enter a valid trusted contact phone number.');
  }
  if (plan.itinerary.length > 1200) throw new HttpError(400, 'Trip notes are too long.');
  return plan;
}

function validateCheckIn(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Enter a valid check-in.');
  }
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const time = typeof body.time === 'string' ? body.time : '';
  if (!label || label.length > 100) throw new HttpError(400, 'Enter a check-in label of up to 100 characters.');
  if (time && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time) || Number.isNaN(new Date(time).getTime()))) {
    throw new HttpError(400, 'Enter a valid check-in time.');
  }
  return { label, time, done: false };
}

function readPlan(db, userId, key) {
  const row = db.prepare(`
    SELECT payload_ciphertext, payload_iv, payload_tag
    FROM trip_plans WHERE user_id = ?
  `).get(userId);
  const trip = row
    ? decryptJson(row, key)
    : { destination: '', departDate: '', returnDate: '', contactName: '', contactPhone: '', itinerary: '' };
  const checkIns = db.prepare(`
    SELECT id, payload_ciphertext, payload_iv, payload_tag
    FROM check_ins WHERE user_id = ? ORDER BY created_at, id
  `).all(userId).map((item) => ({
    id: item.id,
    ...decryptJson(item, key)
  }));
  return { ...trip, checkIns };
}

export function createApp({ db, profileKey, isProduction = process.env.NODE_ENV === 'production' } = {}) {
  if (!db) throw new Error('A SQLite database is required.');
  if (!Buffer.isBuffer(profileKey) || profileKey.length !== 32) {
    throw new Error('A 32-byte profile encryption key is required.');
  }

  const app = express();
  app.disable('x-powered-by');
  if (isProduction) app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", 'https://overpass-api.de'],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    }
  }));
  app.use(express.json({ limit: '24kb', strict: true }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    let expectedOrigin;
    try {
      expectedOrigin = process.env.APP_ORIGIN
        ? new URL(process.env.APP_ORIGIN).origin
        : `${req.protocol}://${req.get('host')}`;
    } catch {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    if (!origin || origin !== expectedOrigin || req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    return next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again in 15 minutes.' }
  });

  app.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  app.get('/api/auth/session', (req, res) => {
    const session = getSession(db, req);
    if (!session) {
      if (readCookie(req, SESSION_COOKIE)) clearSessionCookie(res, isProduction);
      return res.json({ account: null, csrfToken: null });
    }
    const account = db.prepare(`
      SELECT id, profile_ciphertext, profile_iv, profile_tag
      FROM accounts WHERE id = ?
    `).get(session.user_id);
    if (!account) {
      clearSessionCookie(res, isProduction);
      return res.json({ account: null, csrfToken: null });
    }
    return res.json({ account: accountSummary(account, profileKey), csrfToken: session.csrf_token });
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const profile = validateProfile(req.body?.profile);
    const password = validatePassword(req.body?.password);
    const salt = randomBytes(16);
    const passwordHash = await scryptAsync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    });
    const encryptedProfile = encryptJson(profile, profileKey);
    let id;
    do {
      id = `SR-${randomBytes(6).toString('hex').toUpperCase()}`;
    } while (db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(id));

    const session = {
      token: randomBytes(32).toString('base64url'),
      csrfToken: randomBytes(32).toString('base64url'),
      expiresAt: Date.now() + SESSION_LIFETIME_MS
    };
    const tokenHash = hashSessionToken(session.token);
    const insert = db.transaction(() => {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      db.prepare(`
        INSERT INTO accounts (
          id, profile_ciphertext, profile_iv, profile_tag, password_salt, password_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        encryptedProfile.ciphertext,
        encryptedProfile.iv,
        encryptedProfile.tag,
        salt.toString('base64'),
        Buffer.from(passwordHash).toString('base64'),
        new Date().toISOString()
      );
      db.prepare(`
        INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(tokenHash, id, session.csrfToken, session.expiresAt);
    });
    insert.immediate();
    setSessionCookie(res, session.token, isProduction);
    res.status(201).json({
      account: { id, fullName: profile.fullName },
      csrfToken: session.csrfToken
    });
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim().toUpperCase() : '';
    const password = validatePassword(req.body?.password);
    const account = db.prepare(`
      SELECT id, profile_ciphertext, profile_iv, profile_tag, password_salt, password_hash
      FROM accounts WHERE id = ?
    `).get(userId);
    const salt = account ? Buffer.from(account.password_salt, 'base64') : Buffer.alloc(16, 0x5a);
    const candidate = Buffer.from(await scryptAsync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    }));
    const valid = account
      && safeTextEqual(candidate.toString('base64'), account.password_hash);
    if (!valid) throw new HttpError(401, 'User ID or password is incorrect.');

    const session = createSession(db, account.id);
    setSessionCookie(res, session.token, isProduction);
    res.json({
      account: accountSummary(account, profileKey),
      csrfToken: session.csrfToken
    });
  });

  app.post('/api/auth/logout', requireAuth(db, isProduction), requireCsrf, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.auth.tokenHash);
    clearSessionCookie(res, isProduction);
    res.status(204).end();
  });

  app.get('/api/plan', requireAuth(db, isProduction), (req, res) => {
    res.json({ plan: readPlan(db, req.auth.userId, profileKey) });
  });

  app.put('/api/plan', requireAuth(db, isProduction), requireCsrf, (req, res) => {
    const trip = validatePlan(req.body);
    const encrypted = encryptJson(trip, profileKey);
    db.prepare(`
      INSERT INTO trip_plans (
        user_id, payload_ciphertext, payload_iv, payload_tag, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        payload_ciphertext = excluded.payload_ciphertext,
        payload_iv = excluded.payload_iv,
        payload_tag = excluded.payload_tag,
        updated_at = excluded.updated_at
    `).run(
      req.auth.userId,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      new Date().toISOString()
    );
    res.json({ plan: readPlan(db, req.auth.userId, profileKey) });
  });

  app.post('/api/check-ins', requireAuth(db, isProduction), requireCsrf, (req, res) => {
    const checkIn = validateCheckIn(req.body);
    const count = db.prepare('SELECT COUNT(*) AS count FROM check_ins WHERE user_id = ?').get(req.auth.userId).count;
    if (count >= MAX_CHECK_INS) throw new HttpError(409, `A profile can have at most ${MAX_CHECK_INS} check-ins.`);
    const id = randomUUID();
    const encrypted = encryptJson(checkIn, profileKey);
    db.prepare(`
      INSERT INTO check_ins (
        id, user_id, payload_ciphertext, payload_iv, payload_tag, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.auth.userId, encrypted.ciphertext, encrypted.iv, encrypted.tag, new Date().toISOString());
    res.status(201).json({ checkIn: { id, ...checkIn } });
  });

  app.patch('/api/check-ins/:id', requireAuth(db, isProduction), requireCsrf, (req, res) => {
    if (!/^[\da-f-]{36}$/i.test(req.params.id) || typeof req.body?.done !== 'boolean') {
      throw new HttpError(400, 'Enter a valid check-in update.');
    }
    const row = db.prepare(`
      SELECT id, payload_ciphertext, payload_iv, payload_tag
      FROM check_ins WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.auth.userId);
    if (!row) throw new HttpError(404, 'Check-in not found.');
    const checkIn = { ...decryptJson(row), done: req.body.done };
    const encrypted = encryptJson(checkIn, profileKey);
    db.prepare(`
      UPDATE check_ins
      SET payload_ciphertext = ?, payload_iv = ?, payload_tag = ?
      WHERE id = ? AND user_id = ?
    `).run(encrypted.ciphertext, encrypted.iv, encrypted.tag, req.params.id, req.auth.userId);
    res.json({ checkIn: { id: row.id, ...checkIn } });
  });

  app.delete('/api/check-ins/:id', requireAuth(db, isProduction), requireCsrf, (req, res) => {
    if (!/^[\da-f-]{36}$/i.test(req.params.id)) throw new HttpError(400, 'Enter a valid check-in ID.');
    const result = db.prepare('DELETE FROM check_ins WHERE id = ? AND user_id = ?').run(req.params.id, req.auth.userId);
    if (!result.changes) throw new HttpError(404, 'Check-in not found.');
    res.status(204).end();
  });

  const publicFiles = new Set([
    '/',
    '/index.html',
    '/trip-area.html',
    '/styles.css',
    '/app.js',
    '/account-ui.js',
    '/trip-area.js'
  ]);
  const serveStatic = express.static(ROOT, {
    dotfiles: 'deny',
    index: 'index.html',
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  });
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !publicFiles.has(req.path)) return next();
    return serveStatic(req, res, next);
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error('Unhandled request error:', error);
    return res.status(500).json({ error: 'The server could not complete the request.' });
  });

  return app;
}

function requireAuth(db, isProduction) {
  return (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    const session = getSession(db, req);
    if (!session) {
      if (token) clearSessionCookie(res, isProduction);
      return res.status(401).json({ error: 'Sign in to continue.' });
    }
    req.auth = {
      userId: session.user_id,
      csrfToken: session.csrf_token,
      tokenHash: session.token_hash
    };
    return next();
  };
}

function requireCsrf(req, res, next) {
  if (!safeTextEqual(req.get('x-csrf-token'), req.auth.csrfToken)) {
    return res.status(403).json({ error: 'Request verification failed. Refresh the page and try again.' });
  }
  return next();
}

function startServer() {
  const production = process.env.NODE_ENV === 'production';
  const databasePath = resolve(process.env.DATABASE_PATH || join(ROOT, 'data', 'safar-rakshak.sqlite'));
  const profileKey = loadProfileKey(databasePath, production);
  const db = createDatabase(databasePath);
  const app = createApp({ db, profileKey, isProduction: production });
  const port = Number(process.env.PORT || 8080);
  const server = app.listen(port, () => {
    console.log(`SafarRakshak server listening on port ${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    startServer();
  } catch (error) {
    console.error('Could not start SafarRakshak:', error.message);
    process.exitCode = 1;
  }
}
