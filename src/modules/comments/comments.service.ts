import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string, pageId: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.comment.findMany({
      where: { pageId },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, pageId: string, body: string, blockId?: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.comment.create({
      data: { pageId, authorId: userId, body, blockId },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const c = await this.prisma.comment.findUnique({ where: { id }, include: { page: true } });
    if (!c) throw new NotFoundException();
    await this.access.assertMember(userId, c.page.workspaceId);
    if (c.authorId !== userId) throw new NotFoundException();
    return this.prisma.comment.delete({ where: { id } });
  }
}
