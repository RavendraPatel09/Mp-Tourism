import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * Verification worker and scheduler. No HTTP server — this process exists to
 * drain the verification queue and run the crons.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  /*
   * Shutdown hooks matter more here than in the API: a SIGTERM mid-verification
   * must let BullMQ finish or release the job, otherwise a check-in sits pending
   * until the stall timeout while the user waits for points.
   */
  app.enableShutdownHooks();

  const logger = app.get(PinoLogger);
  logger.log('Verification worker started — draining queue and running schedules.');
}

void bootstrap();
