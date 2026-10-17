import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new ForbiddenException('Workspace erişimi yok');
    return m;
  }

  async assertPageAccess(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.trashedAt) throw new NotFoundException('Sayfa bulunamadı');
    await this.assertMember(userId, page.workspaceId);
    return page;
  }
}
