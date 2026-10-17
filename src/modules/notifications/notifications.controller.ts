import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.notifications.list(req.user.id);
  }

  @Get('unread-count')
  unread(@Req() req: { user: { id: string } }) {
    return this.notifications.unreadCount(req.user.id).then((count) => ({ count }));
  }

  @Post(':id/read')
  read(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Post('read-all')
  readAll(@Req() req: { user: { id: string } }) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Post('jobs/due-reminders')
  dueJob() {
    return this.notifications.remindDueTasks();
  }
}
