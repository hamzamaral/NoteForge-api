import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule, WorkspacesModule, NotificationsModule, forwardRef(() => SearchModule)],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
