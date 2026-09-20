import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './swagger';

/**
 * Writes `openapi/openapi.json` without starting a server.
 *
 * Run in CI on every push: if the committed spec and the generated spec differ,
 * the build fails. That is what "frozen contract" means in practice — it stops
 * being a promise and starts being a test.
 *
 * Note that this boots the full application module, so it needs the database
 * and Redis reachable. In CI that is the service container; locally it is
 * docker compose.
 */
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get(ConfigService);
  const apiPrefix = config.getOrThrow<string>('app.apiPrefix');

  await app.init();

  const document = buildOpenApiDocument(app, apiPrefix);
  const outputPath = resolve(__dirname, '../../openapi/openapi.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const pathCount = Object.keys(document.paths).length;
  const operationCount = Object.values(document.paths).reduce(
    (total, path) => total + Object.keys(path as Record<string, unknown>).length,
    0,
  );

  // eslint-disable-next-line no-console
  console.log(`Wrote ${outputPath} — ${pathCount} paths, ${operationCount} operations.`);

  await app.close();
}

generate().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate the OpenAPI spec:', error);
  process.exit(1);
});
