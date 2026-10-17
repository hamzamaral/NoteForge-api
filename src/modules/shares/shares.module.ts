import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
