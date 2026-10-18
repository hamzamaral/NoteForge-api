import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';
import { Role } from '@prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async listForUser(userId: string) {
    const rows = await this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, email: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((w) => ({
      ...w,
      myRole: w.members.find((m) => m.userId === userId)?.role ?? null,
    }));
  }

  async create(userId: string, name: string) {
    return this.prisma.workspace.create({
      data: {
        name,
        members: { create: { userId, role: Role.OWNER } },
        pages: {
          create: {
            title: 'Başlangıç',
            blocks: {
              create: { type: 'paragraph', sortOrder: 1, props: { text: '' } },
            },
          },
        },
      },
    });
  }

  async members(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async invite(userId: string, workspaceId: string, email: string, role: Role) {
    const me = await this.access.assertMember(userId, workspaceId, Role.OWNER);
    if (me.role !== Role.OWNER) {
      throw new ForbiddenException('Davet sadece OWNER');
    }
    if (role === Role.OWNER) {
      throw new ForbiddenException('OWNER rolü davet ile verilemez');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Kullanıcı yok — önce kayıt olsun');
    const member = await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      create: { workspaceId, userId: user.id, role },
      update: { role },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorId: userId,
        action: 'invite',
        meta: { email, role, memberUserId: user.id },
      },
    });
    return member;
  }

  async removeMember(actorId: string, workspaceId: string, memberUserId: string) {
    const me = await this.access.assertMember(actorId, workspaceId);
    if (me.role !== Role.OWNER) throw new ForbiddenException('Sadece owner üye çıkarabilir');
    if (actorId === memberUserId) {
      throw new ForbiddenException('Kendini çıkaramazsın');
    }
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    });
    if (!target) throw new NotFoundException('Üye bulunamadı');
    if (target.role === Role.OWNER) {
      throw new ForbiddenException('Owner çıkarılamaz');
    }
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    });
    return { ok: true };
  }
}
