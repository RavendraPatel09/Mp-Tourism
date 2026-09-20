import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CheckInsService } from '../check-ins/check-ins.service';
import { VERIFICATION_QUEUE, VerificationJobData } from './verification.queue';
import { VerificationService } from './verification.service';

/**
 * Registered only in the worker process (see `worker.module.ts`), so API
 * containers never spend request capacity on image processing.
 *
 * Concurrency of 5: each job downloads an image, decodes it and resizes it, so
 * it is CPU- and memory-bound through sharp. More than a handful per process
 * and the event loop stalls long enough to slow every other job.
 */
@Processor(VERIFICATION_QUEUE, { concurrency: 5 })
export class VerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(VerificationProcessor.name);

  constructor(
    private readonly verification: VerificationService,
    private readonly checkIns: CheckInsService,
  ) {
    super();
  }

  async process(job: Job<VerificationJobData>): Promise<unknown> {
    const outcome = await this.verification.verify(job.data.checkInId);
    this.logger.log(
      `Check-in ${outcome.checkInId}: ${outcome.decision} (score ${outcome.score})` +
        (outcome.reasons.length ? ` — ${outcome.reasons.join(', ')}` : ''),
    );
    return outcome;
  }

  /**
   * A check-in that the pipeline could not judge must not sit pending forever —
   * the user is waiting on points. After the last attempt it goes to a human.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<VerificationJobData>, error: Error): Promise<void> {
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 1;

    this.logger.error(
      `Verification attempt ${attemptsMade}/${maxAttempts} failed for check-in ` +
        `${job.data.checkInId}: ${error.message}`,
      error.stack,
    );

    if (attemptsMade >= maxAttempts) {
      await this.checkIns
        .routeToReview(job.data.checkInId, 0)
        .catch((routeError: unknown) =>
          this.logger.error(
            `Could not route check-in ${job.data.checkInId} to manual review: ${String(routeError)}`,
          ),
        );
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Verification job ${jobId} stalled and will be retried.`);
  }
}
