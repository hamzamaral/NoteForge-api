import { Role } from '@prisma/client';
import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly notifications: NotificationsService,
    @Optional()
    @Inject(forwardRef(() => SearchService))
    private readonly search?: SearchService,
  ) {}

  async list(userId: string, pageId: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.comment.findMany({
      where: { pageId },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, pageId: string, body: string, blockId?: string) {
    await this.access.assertPageWrite(userId, pageId);
    if (blockId) {
      const block = await this.prisma.block.findFirst({ where: { id: blockId, pageId } });
      if (!block) throw new NotFoundException('Blok bulunamadı');
    }
    const comment = await this.prisma.comment.create({
      data: { pageId, authorId: userId, body, blockId },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        page: { select: { id: true, title: true, workspaceId: true } },
      },
    });

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: comment.page.workspaceId },
      select: { userId: true },
    });
    const authorName = comment.author.fullName || comment.author.email;
    for (const m of members) {
      if (m.userId === userId) continue;
      await this.notifications.notify({
        workspaceId: comment.page.workspaceId,
        userId: m.userId,
        type: 'comment',
        title: `${authorName} yorum yazdı`,
        body: `${comment.page.title}: ${body.slice(0, 120)}`,
        href: `/p/${pageId}`,
      });
    }

    const mentionEmails = [...body.matchAll(/@([^\s@]+@[^\s]+)/g)].map((x) => x[1]);
    for (const email of mentionEmails) {
      const u = await this.prisma.user.findUnique({ where: { email } });
      if (!u || u.id === userId) continue;
      await this.notifications.notify({
        workspaceId: comment.page.workspaceId,
        userId: u.id,
        type: 'mention',
        title: `${authorName} sizi mentione etti`,
        body: body.slice(0, 120),
        href: `/p/${pageId}`,
      });
    }

    void this.search?.indexPage(pageId).catch(() => undefined);
    return comment;
  }

  async remove(userId: string, id: string) {
    const c = await this.prisma.comment.findUnique({ where: { id }, include: { page: true } });
    if (!c) throw new NotFoundException();
    const member = await this.access.assertMember(userId, c.page.workspaceId);
    if (c.authorId !== userId && member.role !== Role.OWNER) {
      throw new ForbiddenException('Yorumu sadece yazar veya owner silebilir');
    }
    return this.prisma.comment.delete({ where: { id } });
  }
}
