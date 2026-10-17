import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SyncGateway } from './sync.gateway';

@Module({
  imports: [AuthModule],
  providers: [SyncGateway],
})
export class SyncModule {}
