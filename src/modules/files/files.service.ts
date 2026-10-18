import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
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
const SIGN_TTL_SEC = 7 * 24 * 3600;

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
    console.log('[files] local uploads (signed GET) at', this.uploadRoot);
  }

  private signSecret() {
    return (
      this.config.get<string>('FILE_SIGN_SECRET') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'dev-file-sign'
    );
  }

  signKey(key: string, ttlSec = SIGN_TTL_SEC) {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const payload = `${key}.${exp}`;
    const sig = createHmac('sha256', this.signSecret()).update(payload).digest('hex');
    return { exp, sig };
  }

  verifySignature(key: string, exp: string, sig: string) {
    const expN = Number(exp);
    if (!key || !sig || !expN || expN < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('İmza süresi dolmuş veya geçersiz');
    }
    const payload = `${key}.${expN}`;
    const expect = createHmac('sha256', this.signSecret()).update(payload).digest('hex');
    const a = Buffer.from(expect);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Geçersiz dosya imzası');
    }
  }

  signedUrl(key: string) {
    const { exp, sig } = this.signKey(key);
    return `/api/v1/files/serve?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
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

    if (this.mode === 'minio' && this.minio) {
      await this.minio.putObject(this.bucket, key, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });
    } else {
      const dir = join(this.uploadRoot, workspaceId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(this.uploadRoot, key), file.buffer);
    }

    const url = this.signedUrl(key);
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

  async serve(key: string, exp: string, sig: string) {
    this.verifySignature(key, exp, sig);
    if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      throw new BadRequestException('Geçersiz key');
    }
    const asset = await this.prisma.fileAsset.findFirst({ where: { key } });
    if (!asset) throw new NotFoundException('Dosya yok');

    if (this.mode === 'minio' && this.minio) {
      const stream = await this.minio.getObject(this.bucket, key);
      return { stream, mime: asset.mime, size: asset.size };
    }
    const path = join(this.uploadRoot, key);
    if (!existsSync(path)) throw new NotFoundException('Dosya yok');
    return { buffer: readFileSync(path), mime: asset.mime, size: asset.size };
  }
}
