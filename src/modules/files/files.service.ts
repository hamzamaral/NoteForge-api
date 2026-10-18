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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private minio: any = null;
  private bucket = 'noteforge';

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (!existsSync(this.uploadRoot)) mkdirSync(this.uploadRoot, { recursive: true });
    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    const prefer = this.config.get<string>('MINIO_ENABLED') === '1';
    if (prefer && endpoint) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Minio = require('minio');
        const port = Number(this.config.get<string>('MINIO_PORT') || 9000);
        this.minio = new Minio.Client({
          endPoint: endpoint,
          port,
          useSSL: false,
          accessKey: this.config.get<string>('MINIO_ACCESS_KEY') || 'noteforge',
          secretKey: this.config.get<string>('MINIO_SECRET_KEY') || 'noteforgesecret',
        });
        const exists = await this.minio.bucketExists(this.bucket);
        if (!exists) await this.minio.makeBucket(this.bucket, 'us-east-1');
        this.mode = 'minio';
        // eslint-disable-next-line no-console
        console.log('[files] MinIO mode', endpoint, port);
        return;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[files] MinIO unavailable, using local uploads', String(e));
      }
    }
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

    let url: string;
    if (this.mode === 'minio' && this.minio) {
      await this.minio.putObject(this.bucket, key, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });
      const publicBase =
        this.config.get<string>('MINIO_PUBLIC_URL') ||
        `http://${this.config.get('MINIO_ENDPOINT')}:${this.config.get('MINIO_PORT') || 9000}`;
      url = `${publicBase.replace(/\/$/, '')}/${this.bucket}/${key}`;
    } else {
      const dir = join(this.uploadRoot, workspaceId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(this.uploadRoot, key), file.buffer);
      const publicBase = this.config.get<string>('PUBLIC_FILE_BASE') || '';
      url = publicBase
        ? `${publicBase.replace(/\/$/, '')}/uploads/${key}`
        : `/uploads/${key}`;
    }

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
