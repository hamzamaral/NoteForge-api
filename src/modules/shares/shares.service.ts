import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, SharePermission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, pageId: string, permission: SharePermission = SharePermission.READ) {
    const page = await this.access.assertPageWrite(userId, pageId);
    return this.prisma.pageShare.create({
      data: {
        workspaceId: page.workspaceId,
        pageId,
        permission,
      },
    });
  }

  async list(userId: string, pageId: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.pageShare.findMany({ where: { pageId } });
  }

  async publicGet(token: string) {
    const share = await this.prisma.pageShare.findUnique({
      where: { token },
      include: {
        page: {
          include: {
            blocks: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!share) throw new NotFoundException('Paylaşım bulunamadı');
    return {
      permission: share.permission,
      page: {
        id: share.page.id,
        title: share.page.title,
        icon: share.page.icon,
        blocks: share.page.blocks,
      },
    };
  }

  async revoke(userId: string, shareId: string) {
    const share = await this.prisma.pageShare.findUnique({ where: { id: shareId } });
    if (!share) throw new NotFoundException();
    await this.access.assertMember(userId, share.workspaceId, Role.EDITOR);
    return this.prisma.pageShare.delete({ where: { id: shareId } });
  }

  async publicComment(token: string, body: string, guestName?: string) {
    const share = await this.prisma.pageShare.findUnique({ where: { token } });
    if (!share) throw new NotFoundException('Paylaşım bulunamadı');
    if (share.permission !== SharePermission.COMMENT) {
      throw new ForbiddenException('Bu linkte yorum kapalı');
    }
    // Guest comments stored as system-authored via a dedicated guest user email
    let guest = await this.prisma.user.findUnique({
      where: { email: 'guest@noteforge.local' },
    });
    if (!guest) {
      guest = await this.prisma.user.create({
        data: {
          email: 'guest@noteforge.local',
          fullName: 'Misafir',
          passwordHash: '!',
          emailVerifiedAt: new Date(),
        },
      });
    }
    return this.prisma.comment.create({
      data: {
        pageId: share.pageId,
        authorId: guest.id,
        body: guestName ? `${guestName}: ${body}` : body,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  async publicComments(token: string) {
    const share = await this.prisma.pageShare.findUnique({ where: { token } });
    if (!share) throw new NotFoundException('Paylaşım bulunamadı');
    return this.prisma.comment.findMany({
      where: { pageId: share.pageId },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
