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

  listForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, email: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
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
    const me = await this.access.assertMember(userId, workspaceId);
    if (me.role !== Role.OWNER) throw new ForbiddenException('Sadece owner davet edebilir');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Kullanıcı yok — önce kayıt olsun');
    return this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      create: { workspaceId, userId: user.id, role },
      update: { role },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }
}
