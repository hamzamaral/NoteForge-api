import { Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PassThrough } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (
  format: string,
  opts?: { zlib?: { level: number } },
) => import('archiver').Archiver;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async audit(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId, Role.OWNER);
    return this.prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async log(workspaceId: string, actorId: string | null, action: string, meta: object = {}) {
    return this.prisma.auditLog.create({
      data: { workspaceId, actorId, action, meta },
    });
  }

  async getSetting(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  async setSetting(userId: string, key: string, value: object) {
    const owner = await this.prisma.workspaceMember.findFirst({
      where: { userId, role: Role.OWNER },
    });
    if (!owner) throw new ForbiddenException('Owner gerekli');
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async exportWorkspace(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId, Role.OWNER);
    const pages = await this.prisma.page.findMany({
      where: { workspaceId, trashedAt: null },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
    const tasks = await this.prisma.task.findMany({ where: { workspaceId } });
    const databases = await this.prisma.database.findMany({
      where: { workspaceId },
      include: { properties: true, rows: true, views: true },
    });
    return {
      exportedAt: new Date().toISOString(),
      workspaceId,
      pages,
      tasks,
      databases,
    };
  }

  /** MD + JSON ZIP buffer for download */
  async exportWorkspaceZip(userId: string, workspaceId: string): Promise<Buffer> {
    const data = await this.exportWorkspace(userId, workspaceId);
    const pass = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    pass.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
      archive.on('error', reject);
    });
    archive.pipe(pass);
    archive.append(JSON.stringify(data, null, 2), { name: 'workspace.json' });
    for (const p of data.pages) {
      const md = [
        `# ${p.title}`,
        '',
        ...p.blocks.map((b) => {
          const props = b.props as Record<string, unknown>;
          const text = String(props.text ?? '');
          if (b.type === 'heading') return `${'#'.repeat(Number(props.level) || 2)} ${text}`;
          if (b.type === 'bullet') return `- ${text}`;
          if (b.type === 'todo') return `- [${props.checked ? 'x' : ' '}] ${text}`;
          if (b.type === 'code') return '```\n' + text + '\n```';
          if (b.type === 'quote') return `> ${text}`;
          if (b.type === 'image') return `![${props.alt || ''}](${props.src || ''})`;
          if (b.type === 'divider') return '---';
          if (b.type === 'callout') return `> ${props.emoji || '💡'} ${text}`;
          if (b.type === 'toggle') return `<details><summary>Toggle</summary>\n\n${text}\n\n</details>`;
          if (b.type === 'math') return `$$\n${props.tex || text}\n$$`;
          if (b.type === 'bookmark') return `[${props.title || props.url}](${props.url || ''})`;
          if (b.type === 'drawing') return `*[çizim ${props.sceneId || ''}]*`;
          if (b.type === 'columns') {
            const cols = Array.isArray(props.columns) ? (props.columns as string[]) : [text];
            return cols.map((c) => `> ${c}`).join('\n\n');
          }
          return text;
        }),
        '',
      ].join('\n');
      const safe = p.title.replace(/[^\w\-ığüşöçİĞÜŞÖÇ ]+/gi, '_').slice(0, 60) || p.id;
      archive.append(md, { name: `pages/${safe}-${p.id.slice(0, 8)}.md` });
    }
    await archive.finalize();
    return done;
  }

  async purgeOldTrash(days = 30) {
    const before = new Date(Date.now() - days * 86400_000);
    const res = await this.prisma.page.deleteMany({
      where: { trashedAt: { lt: before } },
    });
    return { deleted: res.count };
  }
}
