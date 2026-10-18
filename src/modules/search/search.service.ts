import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';
import { PagesService } from '../pages/pages.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MeiliSearch } = require('meilisearch') as {
  MeiliSearch: new (opts: { host: string; apiKey: string }) => {
    health: () => Promise<unknown>;
    index: (name: string) => {
      updateFilterableAttributes: (a: string[]) => Promise<unknown>;
      updateSearchableAttributes: (a: string[]) => Promise<unknown>;
      addDocuments: (docs: Record<string, unknown>[]) => Promise<unknown>;
      search: (
        q: string,
        opts: { filter: string; limit: number },
      ) => Promise<{ hits: Record<string, unknown>[] }>;
    };
  };
};

@Injectable()
export class SearchService implements OnModuleInit {
  private client: InstanceType<typeof MeiliSearch> | null = null;
  private ready = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly config: ConfigService,
    private readonly pages: PagesService,
  ) {}

  async onModuleInit() {
    const host = this.config.get<string>('MEILI_HOST') || 'http://127.0.0.1:7700';
    const key = this.config.get<string>('MEILI_KEY') || 'noteforge_meili_dev_key';
    try {
      this.client = new MeiliSearch({ host, apiKey: key });
      await this.client.health();
      const idx = this.client.index('noteforge');
      await idx.updateFilterableAttributes(['workspaceId', 'kind']);
      await idx.updateSearchableAttributes(['title', 'snippet', 'body']);
      this.ready = true;
      // eslint-disable-next-line no-console
      console.log('[search] Meilisearch ready');
    } catch {
      this.client = null;
      this.ready = false;
      // eslint-disable-next-line no-console
      console.warn('[search] Meilisearch down — ILIKE fallback');
    }
  }

  async reindexWorkspace(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId);
    if (!this.client || !this.ready) return { ok: false, reason: 'meili_down' };
    const docs: Record<string, unknown>[] = [];
    const pages = await this.prisma.page.findMany({
      where: { workspaceId, trashedAt: null },
      include: { blocks: true, comments: true },
    });
    for (const p of pages) {
      const body = p.blocks
        .map((b) => {
          const props = b.props as Record<string, unknown>;
          return String(props.text ?? props.alt ?? '');
        })
        .join(' ');
      docs.push({
        id: `page_${p.id}`,
        workspaceId,
        kind: 'page',
        pageId: p.id,
        title: p.title,
        snippet: body.slice(0, 160),
        body,
      });
      for (const c of p.comments) {
        docs.push({
          id: `comment_${c.id}`,
          workspaceId,
          kind: 'comment',
          pageId: p.id,
          title: p.title,
          snippet: c.body.slice(0, 160),
          body: c.body,
        });
      }
    }
    const tasks = await this.prisma.task.findMany({ where: { workspaceId } });
    for (const t of tasks) {
      docs.push({
        id: `task_${t.id}`,
        workspaceId,
        kind: 'task',
        pageId: t.pageId,
        title: t.title,
        snippet: t.title,
        body: t.title,
      });
    }
    const dbs = await this.prisma.database.findMany({
      where: { workspaceId },
      include: { rows: true, page: true },
    });
    for (const db of dbs) {
      for (const row of db.rows) {
        const body = JSON.stringify(row.values);
        docs.push({
          id: `row_${row.id}`,
          workspaceId,
          kind: 'db_row',
          pageId: db.pageId,
          title: db.page.title,
          snippet: body.slice(0, 160),
          body,
        });
      }
    }
    if (docs.length) await this.client.index('noteforge').addDocuments(docs);
    return { ok: true, count: docs.length };
  }

  async search(userId: string, workspaceId: string, q: string, kind?: string) {
    await this.access.assertMember(userId, workspaceId);
    const needle = q.trim();
    if (needle.length < 2) return [];

    if (this.client && this.ready) {
      try {
        const filter = kind
          ? `workspaceId = "${workspaceId}" AND kind = "${kind}"`
          : `workspaceId = "${workspaceId}"`;
        const res = await this.client.index('noteforge').search(needle, {
          filter,
          limit: 40,
        });
        return res.hits.map((h: Record<string, unknown>) => ({
          id: String(h.pageId || h.id),
          title: String(h.title || ''),
          match: String(h.kind || 'content') as
            | 'title'
            | 'content'
            | 'task'
            | 'comment'
            | 'db_row',
          snippet: String(h.snippet || ''),
          score: 80,
          kind: h.kind,
        }));
      } catch {
        /* fall through */
      }
    }
    return this.pages.search(userId, workspaceId, needle);
  }
}
