import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * The frozen API contract (TEAM_PLAN week 1, deliverable 1).
 *
 * This document is the boundary between the three of us. Member A builds the
 * app against it and Member C builds the admin dashboard against it, both from
 * day two, using the mock server in `mock-server.ts` — so neither has to wait
 * for the backend to be finished.
 *
 * Changing an existing field is a breaking change and needs all three of us to
 * agree. Adding a field is not.
 */
export function buildOpenApiDocument(app: INestApplication, apiPrefix: string): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('YatraGo API')
    .setDescription(
      [
        'India tourism discovery and verified exploration platform.',
        '',
        '### Conventions',
        '- **Auth**: `Authorization: Bearer <accessToken>`. Access tokens are short-lived;',
        '  refresh tokens rotate and are single-use. A 401 with `code: "refresh_reused"`',
        '  means the session family was revoked — sign the user out.',
        '- **Errors**: every failure returns `{ statusCode, code, message, details? }`.',
        '  Branch on `code`, never on `message`.',
        '- **Pagination**: cursor-based on lists (`meta.nextCursor`, null on the last page);',
        '  offset-based on leaderboards, where a rank is a meaningful position.',
        '- **Idempotency**: `Idempotency-Key` is required on `POST /check-ins`. Reuse the',
        '  same key for every retry of one submission.',
        '- **Times** are ISO 8601 UTC. Day boundaries (daily caps, monthly leaderboards)',
        '  are IST, because that is the day the user is living in.',
        '',
        '### Points',
        'A verified check-in pays by destination tier, inverted against popularity:',
        'Tier 1 (marquee) 10 · Tier 2 30 · Tier 3 75 · Tier 4 (rare/remote) 150,',
        'plus 100 for being the first person ever to verify a destination.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addServer(`http://localhost:3000/${apiPrefix}`, 'Local')
    .addServer(`https://api-staging.yatrago.in/${apiPrefix}`, 'Staging')
    .addServer(`https://api.yatrago.in/${apiPrefix}`, 'Production')
    .addTag('auth', 'Phone OTP and email/password sign-in')
    .addTag('discovery', 'States, categories, destinations, search — mostly public')
    .addTag('check-ins', 'The atomic action: verified on-location photo check-in')
    .addTag('gamification', 'Points, badges, leaderboards, challenges')
    .addTag('me', 'The authenticated user’s own profile, saved places and history')
    .addTag('user-content', 'Reviews and reports')
    .addTag('media', 'Signed uploads')
    .addTag('admin/destinations', 'Destination CMS — State Admin and Super Admin')
    .addTag('admin/moderation', 'Photo queue, reports and enforcement')
    .addTag('admin/challenges', 'Challenge and campaign management')
    .addTag('admin/analytics', 'Footfall, redistribution KPI and campaign lift')
    .addTag('admin/users', 'User search and moderation detail')
    .addTag('admin/audit', 'Immutable audit log — Super Admin only')
    .addTag('ops', 'Health and readiness')
    .build();

  return SwaggerModule.createDocument(app, config, { deepScanRoutes: true });
}

export function mountSwagger(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'YatraGo API',
  });
}
