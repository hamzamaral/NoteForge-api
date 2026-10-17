import { Injectable, NotFoundException } from '@nestjs/common';
import { SharePermission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, pageId: string, permission: SharePermission = SharePermission.READ) {
    const page = await this.access.assertPageAccess(userId, pageId);
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
    await this.access.assertMember(userId, share.workspaceId);
    return this.prisma.pageShare.delete({ where: { id: shareId } });
  }
}
