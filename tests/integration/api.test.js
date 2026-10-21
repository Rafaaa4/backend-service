import request from 'supertest';
import { createApp } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Session } from '../../src/modules/auth/session.model.js';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectDatabase();
  app = createApp();
});

afterAll(async () => {
  await disconnectDatabase();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Session.deleteMany({});
});

describe('API Integration Tests', () => {
  test('GET /api/v1/health returns 200 OK with server uptime', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('POST /api/v1/auth/register creates user and returns JWT + Refresh Token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test.client@example.tn',
        password: 'SecurePassword123!',
        fullName: 'Test Client',
        phone: '+21620999888'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('test.client@example.tn');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined(); // verify no hash leak
  });

  test('POST /api/v1/auth/login succeeds with valid credentials', async () => {
    // 1. Register
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'login.test@example.tn',
        password: 'Password1234!',
        fullName: 'Login Tester'
      });

    // 2. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login.test@example.tn',
        password: 'Password1234!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.refreshToken).toBeDefined();
  });

  test('POST /api/v1/auth/refresh rotates token and revokes family on reuse attempt', async () => {
    // 1. Register to obtain tokens
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'rotation.test@example.tn',
        password: 'Password1234!',
        fullName: 'Rotation Tester'
      });

    const initialRefreshToken = regRes.body.data.refreshToken;

    // 2. Rotate token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    const newRefreshToken = refreshRes.body.data.refreshToken;
    expect(newRefreshToken).not.toBe(initialRefreshToken);

    // 3. REUSE ATTEMPT: Replaying old initialRefreshToken MUST trigger reuse detection!
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

    // 4. Verification that newRefreshToken was also invalidated due to family revocation!
    const subsequentRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken });

    expect(subsequentRes.status).toBe(401);
  });

  test('GET /api/v1/users/me rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
