import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
