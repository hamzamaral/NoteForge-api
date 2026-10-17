import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DatabasesController } from './databases.controller';
import { DatabasesService } from './databases.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [DatabasesController],
  providers: [DatabasesService],
})
export class DatabasesModule {}
