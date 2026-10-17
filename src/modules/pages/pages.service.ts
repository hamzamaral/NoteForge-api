import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

const TEMPLATES: Record<
  string,
  { title: string; description: string; blocks: { type: string; props: object; sortOrder: number }[] }
> = {
  blank: {
    title: 'Boş sayfa',
    description: 'Sıfırdan yaz',
    blocks: [{ type: 'paragraph', props: { text: '' }, sortOrder: 1 }],
  },
  meeting: {
    title: 'Toplantı notu',
    description: 'Gündem + aksiyonlar',
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
    description: 'Özet + görev listesi',
    blocks: [
      { type: 'heading', props: { level: 1, text: 'Proje özeti' }, sortOrder: 1 },
      { type: 'paragraph', props: { text: 'Hedef:' }, sortOrder: 2 },
      { type: 'heading', props: { level: 2, text: 'Görevler' }, sortOrder: 3 },
      { type: 'todo', props: { text: 'İlk görev', checked: false }, sortOrder: 4 },
      { type: 'paragraph', props: { text: '' }, sortOrder: 5 },
    ],
  },
  brainstorm: {
    title: 'Beyin fırtınası',
    description: 'Fikirler + çizim alanı',
    blocks: [
      { type: 'heading', props: { level: 1, text: 'Beyin fırtınası' }, sortOrder: 1 },
      { type: 'bullet', props: { text: 'Fikir 1' }, sortOrder: 2 },
      { type: 'bullet', props: { text: 'Fikir 2' }, sortOrder: 3 },
      { type: 'heading', props: { level: 2, text: 'Çizim' }, sortOrder: 4 },
      {
        type: 'drawing',
        props: { sceneId: 'brainstorm', scene: null },
        sortOrder: 5,
      },
      { type: 'paragraph', props: { text: '' }, sortOrder: 6 },
    ],
  },
  weekly: {
    title: 'Haftalık plan',
    description: 'Pzt–Paz checklist',
    blocks: [
      { type: 'heading', props: { level: 1, text: 'Haftalık plan' }, sortOrder: 1 },
      { type: 'todo', props: { text: 'Pazartesi', checked: false }, sortOrder: 2 },
      { type: 'todo', props: { text: 'Salı', checked: false }, sortOrder: 3 },
      { type: 'todo', props: { text: 'Çarşamba', checked: false }, sortOrder: 4 },
      { type: 'todo', props: { text: 'Perşembe', checked: false }, sortOrder: 5 },
      { type: 'todo', props: { text: 'Cuma', checked: false }, sortOrder: 6 },
      { type: 'paragraph', props: { text: 'Notlar:' }, sortOrder: 7 },
      { type: 'paragraph', props: { text: '' }, sortOrder: 8 },
    ],
  },
};

export function listPageTemplates() {
  return Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    title: t.title,
    description: t.description,
  }));
}

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
    await this.access.assertMember(userId, workspaceId, Role.EDITOR);
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
    const page = await this.access.assertPageWrite(userId, pageId);
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === pageId) {
        throw new BadRequestException('Sayfa kendi altına taşınamaz');
      }
      const parent = await this.prisma.page.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.workspaceId !== page.workspaceId || parent.trashedAt) {
        throw new BadRequestException('Hedef üst sayfa geçersiz');
      }
      // Prevent cycles: walk ancestors of new parent
      let cursor: string | null = data.parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === pageId) {
          throw new BadRequestException('Döngüsel hiyerarşi engellendi');
        }
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const ancestor: { parentId: string | null } | null =
          await this.prisma.page.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
        cursor = ancestor?.parentId ?? null;
      }
    }
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
    await this.access.assertPageWrite(userId, pageId);
    return this.prisma.page.update({
      where: { id: pageId },
      data: { trashedAt: new Date() },
    });
  }

  async restore(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException();
    await this.access.assertMember(userId, page.workspaceId, Role.EDITOR);
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
    const page = await this.access.assertPageWrite(userId, pageId);
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
      // Snapshot every save (keep last 20)
      await tx.pageSnapshot.create({
        data: {
          pageId,
          version: page.contentVersion + 1,
          title: page.title,
          blocks: blocks as unknown as Prisma.InputJsonValue,
        },
      });
      const old = await tx.pageSnapshot.findMany({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        select: { id: true },
      });
      if (old.length) {
        await tx.pageSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      }
    });

    return this.get(userId, pageId);
  }

  async listSnapshots(userId: string, pageId: string) {
    await this.access.assertPageAccess(userId, pageId);
    return this.prisma.pageSnapshot.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, version: true, title: true, createdAt: true },
    });
  }

  async restoreSnapshot(userId: string, pageId: string, snapshotId: string) {
    await this.access.assertPageWrite(userId, pageId);
    const snap = await this.prisma.pageSnapshot.findFirst({
      where: { id: snapshotId, pageId },
    });
    if (!snap) throw new NotFoundException('Snapshot yok');
    const blocks = snap.blocks as unknown as {
      id?: string;
      type: string;
      props: object;
      sortOrder: number;
    }[];
    const page = await this.prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    return this.saveBlocks(userId, pageId, page.contentVersion, blocks, []);
  }

  listTemplates() {
    return listPageTemplates();
  }

  async importMarkdown(
    userId: string,
    workspaceId: string,
    markdown: string,
    title?: string,
    parentId?: string,
  ) {
    await this.access.assertMember(userId, workspaceId, Role.EDITOR);
    const blocks = markdownToBlocks(markdown);
    const derivedTitle =
      title ||
      markdown
        .split('\n')
        .find((l) => l.startsWith('# '))
        ?.replace(/^#\s+/, '')
        .trim() ||
      'İçe aktarılan';
    return this.prisma.page.create({
      data: {
        workspaceId,
        parentId,
        title: derivedTitle,
        blocks: {
          create: blocks.map((b) => ({
            type: b.type,
            props: b.props as Prisma.InputJsonValue,
            sortOrder: b.sortOrder,
          })),
        },
      },
      include: { blocks: true },
    });
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
    if (needle.length < 2) return [];

    type Hit = {
      id: string;
      title: string;
      icon: string | null;
      updatedAt: Date;
      match: 'title' | 'content' | 'task';
      snippet: string | null;
      score: number;
    };
    const byId = new Map<string, Hit>();

    const byTitle = await this.prisma.page.findMany({
      where: {
        workspaceId,
        trashedAt: null,
        title: { contains: needle, mode: 'insensitive' },
      },
      take: 40,
      select: { id: true, title: true, icon: true, updatedAt: true },
    });
    for (const p of byTitle) {
      byId.set(p.id, {
        id: p.id,
        title: p.title,
        icon: p.icon,
        updatedAt: p.updatedAt,
        match: 'title',
        snippet: null,
        score: 100 + (p.title.toLowerCase().startsWith(needle.toLowerCase()) ? 20 : 0),
      });
    }

    const contentHits = await this.prisma.$queryRaw<
      { pageId: string; props: string; type: string }[]
    >`
      SELECT b."pageId" AS "pageId", b.props::text AS props, b.type AS type
      FROM "Block" b
      JOIN "Page" p ON p.id = b."pageId"
      WHERE p."workspaceId" = ${workspaceId}
        AND p."trashedAt" IS NULL
        AND b.props::text ILIKE ${'%' + needle + '%'}
      LIMIT 60
    `;
    for (const row of contentHits) {
      const snippet = makeSnippet(row.props, needle);
      const existing = byId.get(row.pageId);
      if (existing) {
        if (!existing.snippet && snippet) existing.snippet = snippet;
        continue;
      }
      byId.set(row.pageId, {
        id: row.pageId,
        title: '',
        icon: null,
        updatedAt: new Date(0),
        match: 'content',
        snippet,
        score: 50,
      });
    }

    const missing = [...byId.values()].filter((h) => !h.title);
    if (missing.length) {
      const pages = await this.prisma.page.findMany({
        where: { id: { in: missing.map((m) => m.id) } },
        select: { id: true, title: true, icon: true, updatedAt: true },
      });
      for (const p of pages) {
        const hit = byId.get(p.id);
        if (!hit) continue;
        hit.title = p.title;
        hit.icon = p.icon;
        hit.updatedAt = p.updatedAt;
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        title: { contains: needle, mode: 'insensitive' },
        pageId: { not: null },
      },
      take: 20,
      select: { title: true, pageId: true, status: true, page: { select: { id: true, title: true, icon: true, updatedAt: true, trashedAt: true } } },
    });
    for (const t of tasks) {
      if (!t.page || t.page.trashedAt) continue;
      const existing = byId.get(t.page.id);
      const snippet = `Görev (${t.status}): ${t.title}`;
      if (existing) {
        if (!existing.snippet) existing.snippet = snippet;
        existing.score = Math.max(existing.score, 70);
        continue;
      }
      byId.set(t.page.id, {
        id: t.page.id,
        title: t.page.title,
        icon: t.page.icon,
        updatedAt: t.page.updatedAt,
        match: 'task',
        snippet,
        score: 70,
      });
    }

    return [...byId.values()]
      .filter((h) => h.title)
      .sort((a, b) => b.score - a.score || b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 40)
      .map((h) => ({
        id: h.id,
        title: h.title,
        icon: h.icon,
        updatedAt: h.updatedAt,
        match: h.match,
        snippet: h.snippet,
        score: h.score,
      }));
  }
}

function makeSnippet(propsText: string, needle: string, radius = 48): string | null {
  try {
    const parsed = JSON.parse(propsText) as Record<string, unknown>;
    const text = String(parsed.text ?? parsed.alt ?? propsText);
    const lower = text.toLowerCase();
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx < 0) {
      const clean = text.replace(/\s+/g, ' ').trim();
      return clean ? clean.slice(0, radius * 2) : null;
    }
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + needle.length + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ')}${suffix}`;
  } catch {
    return null;
  }
}

function markdownToBlocks(
  md: string,
): { type: string; props: object; sortOrder: number }[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: { type: string; props: object; sortOrder: number }[] = [];
  let order = 1;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', props: { text: body.join('\n') }, sortOrder: order++ });
      i++;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length || 1;
      blocks.push({
        type: 'heading',
        props: { level: Math.min(level, 3), text: line.replace(/^#+\s*/, '') },
        sortOrder: order++,
      });
    } else if (/^-\s\[[ xX]\]\s/.test(line)) {
      blocks.push({
        type: 'todo',
        props: {
          checked: /\[x\]/i.test(line),
          text: line.replace(/^-\s\[[ xX]\]\s*/, ''),
        },
        sortOrder: order++,
      });
    } else if (/^[-*]\s/.test(line)) {
      blocks.push({
        type: 'bullet',
        props: { text: line.replace(/^[-*]\s+/, '') },
        sortOrder: order++,
      });
    } else if (/^>\s?/.test(line)) {
      blocks.push({
        type: 'quote',
        props: { text: line.replace(/^>\s?/, '') },
        sortOrder: order++,
      });
    } else if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'divider', props: {}, sortOrder: order++ });
    } else if (/^!\[[^\]]*\]\([^)]+\)/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) {
        blocks.push({
          type: 'image',
          props: { alt: m[1], src: m[2] },
          sortOrder: order++,
        });
      }
    } else if (line.trim() === '') {
      // skip blank
    } else {
      blocks.push({ type: 'paragraph', props: { text: line }, sortOrder: order++ });
    }
    i++;
  }
  if (!blocks.length) {
    blocks.push({ type: 'paragraph', props: { text: '' }, sortOrder: 1 });
  }
  return blocks;
}
