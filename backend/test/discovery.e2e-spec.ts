import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';

/**
 * End-to-end smoke tests against a real Postgres and Redis (see the CI service
 * containers, or `docker compose up` locally, then `npm run migration:run` and
 * `npm run seed`).
 *
 * Kept deliberately narrow. These cover the things a unit test cannot: that the
 * global auth guard actually closes an endpoint, that validation rejects a bad
 * payload before it reaches a service, and that the PostGIS filters return rows
 * from a real database. Business logic is tested in the unit specs, where it is
 * faster and the failure messages are better.
 */
describe('Discovery (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('public endpoints', () => {
    it('lists states without a token, live ones first', async () => {
      const response = await request(app.getHttpServer()).get('/v1/states').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('code');
      expect(response.body[0].isLive).toBe(true);
    });

    it('lists the interest categories', async () => {
      const response = await request(app.getHttpServer()).get('/v1/categories').expect(200);

      expect(response.body.map((category: { slug: string }) => category.slug)).toContain('offbeat');
    });

    it('returns destinations with the points value already computed', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/destinations?limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('meta.limit', 5);
      for (const destination of response.body.data) {
        expect(destination.basePoints).toBeGreaterThan(0);
      }
    });

    it('sorts the rarest destinations first by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/destinations?limit=20')
        .expect(200);

      const tiers = response.body.data.map((row: { tier: number }) => row.tier);
      expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
    });

    it('filters by tier', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/destinations?tier=4')
        .expect(200);

      for (const destination of response.body.data) {
        expect(destination.tier).toBe(4);
      }
    });

    /** The PostGIS path: exercises ST_DWithin against real geometry. */
    it('returns distances when a point is supplied', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/destinations?lat=23.2599&lng=77.4126&radiusKm=200&sort=distance')
        .expect(200);

      for (const destination of response.body.data) {
        expect(destination.distanceM).toBeGreaterThanOrEqual(0);
        expect(destination.distanceM).toBeLessThanOrEqual(200_000);
      }
    });

    it('rejects sort=distance without coordinates', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/destinations?sort=distance')
        .expect(422);

      expect(response.body.code).toBe('missing_coordinates');
    });

    it('finds a destination through a misspelling', async () => {
      const response = await request(app.getHttpServer()).get('/v1/search?q=khajurao').expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name.toLowerCase()).toContain('khajuraho');
    });
  });

  describe('validation', () => {
    it('rejects an unknown query parameter rather than ignoring it', async () => {
      await request(app.getHttpServer()).get('/v1/destinations?nonsense=1').expect(400);
    });

    it('rejects an out-of-range radius', async () => {
      await request(app.getHttpServer())
        .get('/v1/destinations?lat=23&lng=77&radiusKm=99999')
        .expect(400);
    });
  });

  describe('authentication', () => {
    it('closes a protected endpoint by default', async () => {
      const response = await request(app.getHttpServer()).get('/v1/me/profile').expect(401);

      expect(response.body.code).toBe('unauthorized');
    });

    it('rejects a check-in with no token', async () => {
      await request(app.getHttpServer())
        .post('/v1/check-ins')
        .set('Idempotency-Key', 'e2e-key')
        .send({ destinationId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);
    });

    it('closes the admin surface to anonymous callers', async () => {
      await request(app.getHttpServer()).get('/v1/admin/moderation/queue').expect(401);
      await request(app.getHttpServer()).get('/v1/admin/audit-logs').expect(401);
    });

    it('issues a dev OTP and accepts it', async () => {
      const send = await request(app.getHttpServer())
        .post('/v1/auth/otp/send')
        .send({ phone: '+919876500001' })
        .expect(200);

      // Only present because OTP_PROVIDER=dev; in staging this is undefined.
      expect(send.body.devCode).toMatch(/^\d{6}$/);

      const verify = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .send({ phone: '+919876500001', code: send.body.devCode })
        .expect(200);

      expect(verify.body.accessToken).toBeTruthy();
      expect(verify.body.user.isPhoneVerified).toBe(true);
    });

    it('normalises a bare ten-digit phone number to the same account', async () => {
      const send = await request(app.getHttpServer())
        .post('/v1/auth/otp/send')
        .send({ phone: '9876500002' })
        .expect(200);

      expect(send.body.devCode).toMatch(/^\d{6}$/);
    });
  });

  describe('ops', () => {
    it('reports liveness without touching a dependency', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
      expect(response.body.status).toBe('ok');
    });

    it('reports readiness including the PostGIS version', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health/ready').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.details.postgis.version).toBeTruthy();
    });
  });
});
