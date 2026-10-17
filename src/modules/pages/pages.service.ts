import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

const TEMPLATES: Record<string, { title: string; blocks: { type: string; props: object; sortOrder: number }[] }> = {
  blank: {
    title: 'Adsız',
    blocks: [{ type: 'paragraph', props: { text: '' }, sortOrder: 1 }],
  },
  meeting: {
    title: 'Toplantı notu',
    blocks: [
      { type: 'heading', props: { level: 1, text: 'Toplantı' }, sortOrder: 1 },
      { type: 'paragraph', props: { text: 'Tarih: ' }, sortOrder: 2 },
      { type: 'heading', props: { level: 2, text: 'Gündem' }, sortOrder: 3 },
      { type: 'bullet', props: { text: '' }, sortOrder: 4 },
      { type: 'heading', props: { level: 2, text: 'Aksiyonlar' }, sortOrder: 5 },
      { type: 'todo', props: { text: '', checked: false }, sortOrder: 6 },
      { type: 'paragraph', props: { text: '' }, sortOrder: 7 },
    ],
  },
  project: {
    title: 'Proje',
    blocks: [
      { type: 'heading', props: { level: 1, text: 'Proje özeti' }, sortOrder: 1 },
      { type: 'paragraph', props: { text: 'Hedef:' }, sortOrder: 2 },
      { type: 'heading', props: { level: 2, text: 'Görevler' }, sortOrder: 3 },
      { type: 'todo', props: { text: 'İlk görev', checked: false }, sortOrder: 4 },
      { type: 'paragraph', props: { text: '' }, sortOrder: 5 },
    ],
  },
};

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async tree(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId);
    return this.prisma.page.findMany({
      where: { workspaceId, trashedAt: null, isTemplate: false },
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        updatedAt: true,
        isFavorite: true,
      },
      orderBy: [{ title: 'asc' }],
    });
  }

  async trash(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId);
    return this.prisma.page.findMany({
      where: { workspaceId, trashedAt: { not: null } },
      orderBy: { trashedAt: 'desc' },
    });
  }

  async get(userId: string, pageId: string) {
    const page = await this.access.assertPageAccess(userId, pageId);
    const blocks = await this.prisma.block.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    });
    const backlinks = await this.prisma.pageLink.findMany({
      where: { toPageId: pageId },
      include: { fromPage: { select: { id: true, title: true } } },
    });
    return { ...page, blocks, backlinks };
  }

  async create(
    userId: string,
    workspaceId: string,
    data: { title?: string; parentId?: string; templateKey?: string },
  ) {
    await this.access.assertMember(userId, workspaceId);
    const tpl = TEMPLATES[data.templateKey || 'blank'] || TEMPLATES.blank;
    return this.prisma.page.create({
      data: {
        workspaceId,
        parentId: data.parentId,
        title: data.title || tpl.title,
        templateKey: data.templateKey,
        blocks: {
          create: tpl.blocks.map((b) => ({
            type: b.type,
            props: b.props as Prisma.InputJsonValue,
            sortOrder: b.sortOrder,
          })),
        },
      },
      include: { blocks: true },
    });
  }

  async updateMeta(
    userId: string,
    pageId: string,
    data: { title?: string; icon?: string; parentId?: string | null; isFavorite?: boolean },
  ) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        title: data.title,
        icon: data.icon,
        parentId: data.parentId,
        isFavorite: data.isFavorite,
      },
    });
  }

  async softDelete(userId: string, pageId: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.page.update({
      where: { id: pageId },
      data: { trashedAt: new Date() },
    });
  }

  async restore(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException();
    await this.access.assertMember(userId, page.workspaceId);
    return this.prisma.page.update({
      where: { id: pageId },
      data: { trashedAt: null },
    });
  }

  async saveBlocks(
    userId: string,
    pageId: string,
    expectedVersion: number,
    blocks: { id?: string; type: string; props: object; sortOrder: number; parentBlockId?: string | null }[],
    links?: { toPageId: string }[],
  ) {
    const page = await this.access.assertPageAccess(userId, pageId);
    if (page.contentVersion !== expectedVersion) {
      throw new ConflictException({
        message: 'Sürüm çakışması',
        currentVersion: page.contentVersion,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.block.deleteMany({ where: { pageId } });
      if (blocks.length) {
        for (const b of blocks) {
          await tx.block.create({
            data: {
              ...(b.id ? { id: b.id } : {}),
              pageId,
              type: b.type,
              props: b.props as Prisma.InputJsonValue,
              sortOrder: b.sortOrder,
              parentBlockId: b.parentBlockId ?? null,
            },
          });
        }
      }
      await tx.page.update({
        where: { id: pageId },
        data: { contentVersion: { increment: 1 } },
      });
      if (links) {
        await tx.pageLink.deleteMany({ where: { fromPageId: pageId } });
        const uniq = [...new Set(links.map((l) => l.toPageId).filter((id) => id !== pageId))];
        if (uniq.length) {
          await tx.pageLink.createMany({
            data: uniq.map((toPageId) => ({ fromPageId: pageId, toPageId })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.get(userId, pageId);
  }

  async exportMarkdown(userId: string, pageId: string) {
    const page = await this.get(userId, pageId);
    const lines: string[] = [`# ${page.title}`, ''];
    for (const b of page.blocks) {
      const p = b.props as Record<string, unknown>;
      const text = String(p.text ?? '');
      switch (b.type) {
        case 'heading':
          lines.push(`${'#'.repeat(Number(p.level) || 1)} ${text}`);
          break;
        case 'bullet':
          lines.push(`- ${text}`);
          break;
        case 'todo':
          lines.push(`- [${p.checked ? 'x' : ' '}] ${text}`);
          break;
        case 'quote':
          lines.push(`> ${text}`);
          break;
        case 'code':
          lines.push('```', text, '```');
          break;
        case 'divider':
          lines.push('---');
          break;
        case 'drawing':
          lines.push('*[çizim bloğu]*');
          break;
        case 'image':
          lines.push(`![${String(p.alt || 'görsel')}](${String(p.src || '')})`);
          break;
        default:
          lines.push(text);
      }
      lines.push('');
    }
    return { title: page.title, markdown: lines.join('\n') };
  }

  async search(userId: string, workspaceId: string, q: string) {
    await this.access.assertMember(userId, workspaceId);
    const needle = q.trim();
    if (!needle) return [];
    const byTitle = await this.prisma.page.findMany({
      where: {
        workspaceId,
        trashedAt: null,
        title: { contains: needle, mode: 'insensitive' },
      },
      take: 30,
      select: { id: true, title: true, icon: true, updatedAt: true },
    });
    const blocks = await this.prisma.$queryRaw<{ pageId: string }[]>`
      SELECT DISTINCT b."pageId" AS "pageId"
      FROM "Block" b
      JOIN "Page" p ON p.id = b."pageId"
      WHERE p."workspaceId" = ${workspaceId}
        AND p."trashedAt" IS NULL
        AND b.props::text ILIKE ${'%' + needle + '%'}
      LIMIT 30
    `;
    const extraIds = blocks.map((b) => b.pageId).filter((id) => !byTitle.some((p) => p.id === id));
    const extra = extraIds.length
      ? await this.prisma.page.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, title: true, icon: true, updatedAt: true },
        })
      : [];
    return [...byTitle, ...extra];
  }
}
