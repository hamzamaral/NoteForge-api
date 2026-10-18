import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    const meili = (global as { __nfMeili?: string }).__nfMeili || 'unknown';
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      meili,
      syncRooms: (global as { __nfSyncRoomCount?: number }).__nfSyncRoomCount ?? 0,
      ts: new Date().toISOString(),
    };
  }
}
