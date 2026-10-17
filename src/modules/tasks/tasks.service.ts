import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, workspaceId: string, pageId?: string) {
    await this.access.assertMember(userId, workspaceId);
    return this.prisma.task.findMany({
      where: { workspaceId, ...(pageId ? { pageId } : {}) },
      include: { assignee: { select: { id: true, fullName: true } }, page: { select: { id: true, title: true } } },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async create(
    userId: string,
    data: { workspaceId: string; pageId?: string; title: string; dueAt?: string },
  ) {
    await this.access.assertMember(userId, data.workspaceId);
    return this.prisma.task.create({
      data: {
        workspaceId: data.workspaceId,
        pageId: data.pageId,
        title: data.title,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      },
    });
  }

  async update(
    userId: string,
    id: string,
    data: { title?: string; status?: TaskStatus; dueAt?: string | null; pageId?: string | null },
  ) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) return null;
    await this.access.assertMember(userId, task.workspaceId);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        status: data.status,
        dueAt: data.dueAt === undefined ? undefined : data.dueAt ? new Date(data.dueAt) : null,
        pageId: data.pageId,
      },
    });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) return null;
    await this.access.assertMember(userId, task.workspaceId);
    return this.prisma.task.delete({ where: { id } });
  }
}
