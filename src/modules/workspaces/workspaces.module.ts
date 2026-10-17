import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceAccessService } from '../../common/workspace.guard';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceAccessService],
  exports: [WorkspaceAccessService, WorkspacesService],
})
export class WorkspacesModule {}
