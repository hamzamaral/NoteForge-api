import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceAccessService } from '../../common/workspace.guard';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

@Injectable()
export class FilesService implements OnModuleInit {
  private uploadRoot = join(process.cwd(), 'uploads');
  private mode: 'local' | 'minio' = 'local';

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!existsSync(this.uploadRoot)) mkdirSync(this.uploadRoot, { recursive: true });
    // Prefer local disk when MinIO image unavailable in this environment
    this.mode = 'local';
    // eslint-disable-next-line no-console
    console.log('[files] local uploads at', this.uploadRoot);
  }

  async upload(
    userId: string,
    workspaceId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    await this.access.assertMember(userId, workspaceId, Role.EDITOR);
    if (!ALLOWED.has(file.mimetype)) throw new BadRequestException('MIME desteklenmiyor');
    if (file.size > MAX_BYTES) throw new BadRequestException('Dosya 8MB üstü');

    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    const key = `${workspaceId}/${randomUUID()}-${safe}`;
    const dir = join(this.uploadRoot, workspaceId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(this.uploadRoot, key), file.buffer);

    const publicBase =
      this.config.get<string>('PUBLIC_FILE_BASE') || '';
    const url = publicBase
      ? `${publicBase.replace(/\/$/, '')}/uploads/${key}`
      : `/uploads/${key}`;
    return this.prisma.fileAsset.create({
      data: {
        workspaceId,
        uploaderId: userId,
        key,
        url,
        mime: file.mimetype,
        size: file.size,
      },
    });
  }
}
