import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildOpenApiDocument, mountSwagger } from './openapi/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(PinoLogger));

  const apiPrefix = config.getOrThrow<string>('app.apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  app.use(
    helmet({
      // The API serves JSON to a native app and a separate web origin.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = config.getOrThrow<string[]>('app.corsOrigins');
  app.enableCors({
    /*
     * The mobile app sends no Origin header, so it is unaffected by this list.
     * It exists for the admin dashboard and the public web front end.
     */
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  /** Behind an ALB, so `request.ip` must come from X-Forwarded-For for rate limiting. */
  app.set('trust proxy', 1);

  app.enableShutdownHooks();

  const document = buildOpenApiDocument(app, apiPrefix);
  mountSwagger(app, document);

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');

  const logger = app.get(PinoLogger);
  logger.log(`API listening on :${port}/${apiPrefix} — docs at /docs`);
}

void bootstrap();
