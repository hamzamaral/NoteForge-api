import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

@Injectable()
export class DatabasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, workspaceId: string, name?: string) {
    await this.access.assertMember(userId, workspaceId);
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          workspaceId,
          title: name || 'Veritabanı',
          blocks: {
            create: { type: 'paragraph', sortOrder: 1, props: { text: 'Veritabanı sayfası' } },
          },
        },
      });
      const db = await tx.database.create({
        data: {
          workspaceId,
          pageId: page.id,
          name: name || 'Veritabanı',
          properties: {
            create: [
              { name: 'Ad', type: 'text', sortOrder: 1 },
              { name: 'Durum', type: 'select', options: ['Yeni', 'Devam', 'Bitti'], sortOrder: 2 },
              { name: 'Tarih', type: 'date', sortOrder: 3 },
            ],
          },
          views: {
            create: [
              { name: 'Tablo', type: 'table', config: {} },
              { name: 'Board', type: 'board', config: { groupBy: 'Durum' } },
            ],
          },
          rows: {
            create: [
              { values: { Ad: 'Örnek satır', Durum: 'Yeni' }, sortOrder: 1 },
            ],
          },
        },
        include: { properties: true, views: true, rows: true, page: true },
      });
      return db;
    });
  }

  async get(userId: string, databaseId: string) {
    const db = await this.prisma.database.findUnique({
      where: { id: databaseId },
      include: {
        properties: { orderBy: { sortOrder: 'asc' } },
        views: true,
        rows: { orderBy: { sortOrder: 'asc' } },
        page: true,
      },
    });
    if (!db) throw new NotFoundException();
    await this.access.assertMember(userId, db.workspaceId);
    return db;
  }

  async byPage(userId: string, pageId: string) {
    const page = await this.access.assertPageAccess(userId, pageId);
    const db = await this.prisma.database.findUnique({
      where: { pageId: page.id },
      include: {
        properties: { orderBy: { sortOrder: 'asc' } },
        views: true,
        rows: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return db;
  }

  async addRow(userId: string, databaseId: string, values: Record<string, unknown>) {
    const db = await this.get(userId, databaseId);
    return this.prisma.databaseRow.create({
      data: {
        databaseId: db.id,
        values: values as Prisma.InputJsonValue,
        sortOrder: Date.now(),
      },
    });
  }

  async updateRow(userId: string, rowId: string, values: Record<string, unknown>) {
    const row = await this.prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { database: true },
    });
    if (!row) throw new NotFoundException();
    await this.access.assertMember(userId, row.database.workspaceId);
    return this.prisma.databaseRow.update({
      where: { id: rowId },
      data: { values: values as Prisma.InputJsonValue },
    });
  }

  async updateView(
    userId: string,
    viewId: string,
    config: Record<string, unknown>,
  ) {
    const view = await this.prisma.databaseView.findUnique({
      where: { id: viewId },
      include: { database: true },
    });
    if (!view) throw new NotFoundException();
    await this.access.assertMember(userId, view.database.workspaceId);
    return this.prisma.databaseView.update({
      where: { id: viewId },
      data: { config: config as Prisma.InputJsonValue },
    });
  }
}
