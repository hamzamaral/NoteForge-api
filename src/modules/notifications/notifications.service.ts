import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async notify(opts: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    href?: string;
  }) {
    if (!opts.userId) return null;
    return this.prisma.notification.create({ data: opts });
  }

  /** Due tasks in next 24h → notify assignees (local cron / poll) */
  async remindDueTasks() {
    const until = new Date(Date.now() + 86400_000);
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: { not: null },
        dueAt: { lte: until, gte: new Date() },
        status: { not: 'DONE' },
      },
    });
    let n = 0;
    for (const t of tasks) {
      if (!t.assigneeId) continue;
      await this.notify({
        workspaceId: t.workspaceId,
        userId: t.assigneeId,
        type: 'task_due',
        title: `Yaklaşan görev: ${t.title}`,
        body: t.dueAt?.toISOString(),
        href: t.pageId ? `/p/${t.pageId}` : undefined,
      });
      n++;
    }
    return { reminded: n };
  }
}
