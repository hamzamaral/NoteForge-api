import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, fullName: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('E-posta kullanımda');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        memberships: {
          create: {
            role: Role.OWNER,
            workspace: { create: { name: `${fullName} Workspace` } },
          },
        },
      },
    });
    return this.issueTokens(user.id, user.email, user.fullName);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Geçersiz kimlik bilgileri');
    }
    return this.issueTokens(user.id, user.email, user.fullName);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException('Refresh geçersiz');
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issueTokens(row.user.id, row.user.email, row.user.fullName);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, fullName: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') || '15m',
      },
    );
    const refreshRaw = randomBytes(48).toString('hex');
    const days = 7;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshRaw),
        expiresAt: new Date(Date.now() + days * 86400000),
      },
    });
    return {
      user: { id: userId, email, fullName },
      accessToken,
      refreshToken: refreshRaw,
    };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
