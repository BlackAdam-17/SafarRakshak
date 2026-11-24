import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createApp, createDatabase } from './server.js';

let db;
let server;
let baseUrl;

const profile = {
  fullName: 'Test Traveler',
  address: '1 Test Street',
  mobile: '+1 555 555 0100',
  age: 30,
  gender: 'Prefer not to say',
  role: 'Traveler'
};

beforeEach(async () => {
  db = createDatabase(':memory:');
  const app = createApp({ db, profileKey: Buffer.alloc(32, 7) });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) db.close();
});

async function request(path, {
  method = 'GET',
  body,
  cookie,
  csrfToken,
  origin = baseUrl
} = {}) {
  const headers = { Accept: 'application/json' };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const content = response.status === 204 ? null : await response.json();
  const setCookie = response.headers.get('set-cookie');
  return {
    response,
    content,
    cookie: setCookie ? setCookie.split(';', 1)[0] : null
  };
}

async function register(fullName = profile.fullName) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: {
      profile: { ...profile, fullName },
      password: 'a unique test password'
    }
  });
  assert.equal(result.response.status, 201);
  return result;
}

test('registration encrypts the profile, hashes the password, and requires CSRF verification', async () => {
  const registered = await register();
  assert.match(registered.content.account.id, /^SR-[\dA-F]{12}$/);
  assert.match(registered.cookie, /safar_rakshak_session=/);
  assert.match(registered.response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(registered.response.headers.get('set-cookie'), /SameSite=Strict/i);

  const accountRow = db.prepare('SELECT * FROM accounts WHERE id = ?').get(registered.content.account.id);
  assert.ok(accountRow.profile_ciphertext);
  assert.ok(accountRow.password_hash);
  assert.notEqual(accountRow.profile_ciphertext, JSON.stringify(profile));
  assert.notEqual(accountRow.password_hash, 'a unique test password');
  assert.equal(accountRow.profile_ciphertext.includes(profile.address), false);
  assert.equal(accountRow.password_hash.includes('a unique test password'), false);

  const unauthenticated = await request('/api/plan');
  assert.equal(unauthenticated.response.status, 401);

  const csrfRejected = await request('/api/plan', {
    method: 'PUT',
    cookie: registered.cookie,
    body: { destination: 'Jaipur' }
  });
  assert.equal(csrfRejected.response.status, 403);

  const saved = await request('/api/plan', {
    method: 'PUT',
    cookie: registered.cookie,
    csrfToken: registered.content.csrfToken,
    body: { destination: 'Jaipur', itinerary: 'Train to Jaipur' }
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.content.plan.destination, 'Jaipur');
  assert.equal(saved.content.plan.itinerary, 'Train to Jaipur');

  const loggedOut = await request('/api/auth/logout', {
    method: 'POST',
    cookie: registered.cookie,
    csrfToken: registered.content.csrfToken
  });
  assert.equal(loggedOut.response.status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
  const afterLogout = await request('/api/plan', { cookie: registered.cookie });
  assert.equal(afterLogout.response.status, 401);
});

test('authentication rejects cross-origin requests and invalid credentials', async () => {
  const crossOrigin = await request('/api/auth/register', {
    method: 'POST',
    origin: 'https://attacker.example',
    body: { profile, password: 'a unique test password' }
  });
  assert.equal(crossOrigin.response.status, 403);

  const registered = await register();
  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { userId: registered.content.account.id, password: 'a different password' }
  });
  assert.equal(wrongPassword.response.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { userId: registered.content.account.id, password: 'a unique test password' }
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.content.account.fullName, profile.fullName);
  assert.ok(login.cookie);
});

test('registration rejects malformed phone numbers and weak passwords', async () => {
  const invalidPhone = await request('/api/auth/register', {
    method: 'POST',
    body: {
      profile: { ...profile, mobile: '          ' },
      password: 'a unique test password'
    }
  });
  assert.equal(invalidPhone.response.status, 400);

  const weakPassword = await request('/api/auth/register', {
    method: 'POST',
    body: { profile, password: 'short' }
  });
  assert.equal(weakPassword.response.status, 400);
});

test('trip plans and check-ins are isolated to the authenticated account', async () => {
  const first = await register('First Traveler');
  const createdCheckIn = await request('/api/check-ins', {
    method: 'POST',
    cookie: first.cookie,
    csrfToken: first.content.csrfToken,
    body: { label: 'Arrived at hotel', time: '' }
  });
  assert.equal(createdCheckIn.response.status, 201);

  const second = await register('Second Traveler');
  const secondPlan = await request('/api/plan', { cookie: second.cookie });
  assert.equal(secondPlan.content.plan.destination, '');
  assert.deepEqual(secondPlan.content.plan.checkIns, []);

  const accessDenied = await request(`/api/check-ins/${createdCheckIn.content.checkIn.id}`, {
    method: 'DELETE',
    cookie: second.cookie,
    csrfToken: second.content.csrfToken
  });
  assert.equal(accessDenied.response.status, 404);

  const firstPlan = await request('/api/plan', { cookie: first.cookie });
  assert.equal(firstPlan.content.plan.checkIns.length, 1);
  assert.equal(firstPlan.content.plan.checkIns[0].label, 'Arrived at hotel');
});
