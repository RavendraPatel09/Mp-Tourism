import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const VERIFICATION_QUEUE = 'verification';

export interface VerificationJobData {
  checkInId: string;
}

@Injectable()
export class VerificationQueue {
  private readonly logger = new Logger(VerificationQueue.name);

  constructor(
    @InjectQueue(VERIFICATION_QUEUE) private readonly queue: Queue<VerificationJobData>,
  ) {}

  /**
   * The job id is the check-in id, which makes enqueueing idempotent: a retried
   * submit or a re-delivered event cannot put the same check-in through the
   * pipeline twice and award it twice.
   */
  async enqueue(checkInId: string): Promise<void> {
    await this.queue.add(
      'verify',
      { checkInId },
      {
        jobId: checkInId,
        attempts: 5,
        /*
         * Exponential backoff from 2 s. The failures worth retrying are object
         * storage hiccups and pHash timeouts, which clear in seconds; anything
         * still failing after five attempts is a bug and belongs in the manual
         * queue, not in an infinite retry loop.
         */
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86_400, count: 5000 },
        removeOnFail: false,
      },
    );
    this.logger.debug(`Queued verification for check-in ${checkInId}`);
  }

  async depth(): Promise<{ waiting: number; active: number; failed: number }> {
    const [waiting, active, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, failed };
  }
}
