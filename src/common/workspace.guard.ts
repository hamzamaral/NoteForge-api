import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(userId: string, workspaceId: string, minRole: Role = Role.VIEWER) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new ForbiddenException('Workspace erişimi yok');
    if (RANK[m.role] < RANK[minRole]) {
      throw new ForbiddenException(
        minRole === Role.EDITOR
          ? 'Salt okuma — düzenleme için EDITOR/OWNER gerekli'
          : 'Bu işlem için yetkiniz yok',
      );
    }
    return m;
  }

  async assertPageAccess(userId: string, pageId: string, minRole: Role = Role.VIEWER) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.trashedAt) throw new NotFoundException('Sayfa bulunamadı');
    await this.assertMember(userId, page.workspaceId, minRole);
    return page;
  }

  /** Mutating page content / meta */
  assertPageWrite(userId: string, pageId: string) {
    return this.assertPageAccess(userId, pageId, Role.EDITOR);
  }

  roleOf(userId: string, workspaceId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }
}
