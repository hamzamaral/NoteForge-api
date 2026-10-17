import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

const PROP_TYPES = new Set([
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'checkbox',
  'url',
  'person',
  'files',
]);

@Injectable()
export class DatabasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, workspaceId: string, name?: string) {
    await this.access.assertMember(userId, workspaceId, Role.EDITOR);
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          workspaceId,
          title: name || 'Veritabanı',
          blocks: {
            create: {
              type: 'paragraph',
              sortOrder: 1,
              props: { text: 'Veritabanı sayfası — tablo / board görünümleri' },
            },
          },
        },
      });
      return tx.database.create({
        data: {
          workspaceId,
          pageId: page.id,
          name: name || 'Veritabanı',
          properties: {
            create: [
              { name: 'Ad', type: 'text', sortOrder: 1 },
              {
                name: 'Durum',
                type: 'select',
                options: ['Yeni', 'Devam', 'Bitti'],
                sortOrder: 2,
              },
              { name: 'Öncelik', type: 'select', options: ['Düşük', 'Orta', 'Yüksek'], sortOrder: 3 },
              { name: 'Skor', type: 'number', sortOrder: 4 },
              { name: 'Tarih', type: 'date', sortOrder: 5 },
            ],
          },
          views: {
            create: [
              {
                name: 'Tablo',
                type: 'table',
                config: { sortBy: 'Ad', sortDir: 'asc', filter: {} },
              },
              {
                name: 'Board',
                type: 'board',
                config: { groupBy: 'Durum', filter: {} },
              },
              {
                name: 'Takvim',
                type: 'calendar',
                config: { dateProp: 'Tarih' },
              },
              {
                name: 'Galeri',
                type: 'gallery',
                config: { titleProp: 'Ad' },
              },
              {
                name: 'Liste',
                type: 'list',
                config: {},
              },
            ],
          },
          rows: {
            create: [
              {
                values: { Ad: 'Örnek satır', Durum: 'Yeni', Öncelik: 'Orta', Skor: 1 },
                sortOrder: 1,
              },
              {
                values: { Ad: 'İkinci örnek', Durum: 'Devam', Öncelik: 'Yüksek', Skor: 3 },
                sortOrder: 2,
              },
            ],
          },
        },
        include: { properties: true, views: true, rows: true, page: true },
      });
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
    return this.prisma.database.findUnique({
      where: { pageId: page.id },
      include: {
        properties: { orderBy: { sortOrder: 'asc' } },
        views: true,
        rows: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async rename(userId: string, databaseId: string, name: string) {
    const db = await this.get(userId, databaseId);
    const updated = await this.prisma.database.update({
      where: { id: db.id },
      data: { name },
    });
    await this.prisma.page.update({
      where: { id: db.pageId },
      data: { title: name },
    });
    return updated;
  }

  async addProperty(
    userId: string,
    databaseId: string,
    data: { name: string; type: string; options?: string[] },
  ) {
    const db = await this.get(userId, databaseId);
    if (!PROP_TYPES.has(data.type)) {
      throw new BadRequestException('Geçersiz property tipi');
    }
    const name = data.name.trim();
    if (!name) throw new BadRequestException('İsim gerekli');
    if (db.properties.some((p) => p.name === name)) {
      throw new BadRequestException('Bu isimde kolon zaten var');
    }
    return this.prisma.databaseProperty.create({
      data: {
        databaseId: db.id,
        name,
        type: data.type,
        options: (data.options || []) as Prisma.InputJsonValue,
        sortOrder: Date.now(),
      },
    });
  }

  async deleteProperty(userId: string, propertyId: string) {
    const prop = await this.prisma.databaseProperty.findUnique({
      where: { id: propertyId },
      include: { database: true },
    });
    if (!prop) throw new NotFoundException();
    await this.access.assertMember(userId, prop.database.workspaceId, Role.EDITOR);
    if (prop.name === 'Ad') {
      throw new BadRequestException('Ad kolonu silinemez');
    }
    const rows = await this.prisma.databaseRow.findMany({
      where: { databaseId: prop.databaseId },
    });
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const values = { ...(row.values as Record<string, unknown>) };
        delete values[prop.name];
        await tx.databaseRow.update({
          where: { id: row.id },
          data: { values: values as Prisma.InputJsonValue },
        });
      }
      await tx.databaseProperty.delete({ where: { id: propertyId } });
    });
    return { ok: true };
  }

  async addRow(userId: string, databaseId: string, values: Record<string, unknown>) {
    const db = await this.get(userId, databaseId);
    const defaults: Record<string, unknown> = {};
    for (const p of db.properties) {
      if (values[p.name] !== undefined) continue;
      if (p.type === 'select') {
        const opts = (p.options as string[]) || [];
        defaults[p.name] = opts[0] || '';
      } else if (p.type === 'number') {
        defaults[p.name] = 0;
      } else {
        defaults[p.name] = p.name === 'Ad' ? 'Yeni' : '';
      }
    }
    return this.prisma.databaseRow.create({
      data: {
        databaseId: db.id,
        values: { ...defaults, ...values } as Prisma.InputJsonValue,
        sortOrder: Date.now(),
      },
    });
  }

  async openRowAsPage(userId: string, rowId: string) {
    const row = await this.prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { database: true },
    });
    if (!row) throw new NotFoundException();
    await this.access.assertMember(userId, row.database.workspaceId, Role.EDITOR);
    if (row.pageId) return this.prisma.page.findUnique({ where: { id: row.pageId } });
    const title = String((row.values as Record<string, unknown>).Ad || 'Satır');
    const page = await this.prisma.page.create({
      data: {
        workspaceId: row.database.workspaceId,
        parentId: row.database.pageId,
        title,
        blocks: {
          create: {
            type: 'paragraph',
            sortOrder: 1,
            props: { text: `DB satırı: ${title}` },
          },
        },
      },
    });
    await this.prisma.databaseRow.update({
      where: { id: rowId },
      data: { pageId: page.id },
    });
    return page;
  }

  async updateRow(userId: string, rowId: string, values: Record<string, unknown>) {
    const row = await this.prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { database: true },
    });
    if (!row) throw new NotFoundException();
    await this.access.assertMember(userId, row.database.workspaceId, Role.EDITOR);
    return this.prisma.databaseRow.update({
      where: { id: rowId },
      data: { values: values as Prisma.InputJsonValue },
    });
  }

  async deleteRow(userId: string, rowId: string) {
    const row = await this.prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { database: true },
    });
    if (!row) throw new NotFoundException();
    await this.access.assertMember(userId, row.database.workspaceId, Role.EDITOR);
    await this.prisma.databaseRow.delete({ where: { id: rowId } });
    return { ok: true };
  }

  async updateView(
    userId: string,
    viewId: string,
    data: { config?: Record<string, unknown>; name?: string },
  ) {
    const view = await this.prisma.databaseView.findUnique({
      where: { id: viewId },
      include: { database: true },
    });
    if (!view) throw new NotFoundException();
    await this.access.assertMember(userId, view.database.workspaceId, Role.EDITOR);
    return this.prisma.databaseView.update({
      where: { id: viewId },
      data: {
        name: data.name,
        config: data.config
          ? ({ ...(view.config as object), ...data.config } as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
