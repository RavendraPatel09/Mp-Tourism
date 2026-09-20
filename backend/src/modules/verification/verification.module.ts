import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, VerificationSignal } from 'src/entities';
import { MediaModule } from '../media/media.module';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { VerificationQueue } from './verification.queue';
import { VerificationService } from './verification.service';
import { VERIFICATION_QUEUE } from './verification.queue';

/**
 * The queue producer lives here and is imported by the API; the consumer
 * (`VerificationProcessor`) is registered separately in the worker application,
 * so API containers never do image processing.
 *
 * `forwardRef` because the dependency is genuinely mutual: check-ins enqueue
 * verification, and verification approves or rejects check-ins. Splitting that
 * into a third module would add a layer of indirection without removing the
 * cycle it models.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: VERIFICATION_QUEUE }),
    TypeOrmModule.forFeature([CheckIn, VerificationSignal]),
    MediaModule,
    forwardRef(() => CheckInsModule),
  ],
  providers: [VerificationQueue, VerificationService],
  exports: [VerificationQueue, VerificationService, BullModule],
})
export class VerificationModule {}
