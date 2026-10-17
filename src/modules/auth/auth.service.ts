import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
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
    const verifyToken = randomBytes(24).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        verifyToken,
        memberships: {
          create: {
            role: Role.OWNER,
            workspace: { create: { name: `${fullName} Workspace` } },
          },
        },
      },
    });
    // Dev: log verification link (Mailhog optional)
    // eslint-disable-next-line no-console
    console.log(`[auth] verify email ${email}: /api/v1/auth/verify?token=${verifyToken}`);
    return this.issueTokens(user.id, user.email, user.fullName, user.emailVerifiedAt);
  }

  async login(email: string, password: string, ip?: string) {
    await this.assertNotRateLimited(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = !!user && (await bcrypt.compare(password, user.passwordHash));
    await this.prisma.loginAttempt.create({
      data: { email: email.toLowerCase(), ip: ip || null, ok },
    });
    if (!ok) throw new UnauthorizedException('Geçersiz kimlik bilgileri');
    return this.issueTokens(user!.id, user!.email, user!.fullName, user!.emailVerifiedAt);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) throw new BadRequestException('Doğrulama geçersiz');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), verifyToken: null },
    });
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always ok — no email enumeration
    if (user) {
      const resetToken = randomBytes(24).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetExpiresAt: new Date(Date.now() + 3600_000),
        },
      });
      // eslint-disable-next-line no-console
      console.log(`[auth] reset ${email}: token=${resetToken}`);
    }
    return { ok: true, message: 'Varsa e-posta kutusunu / sunucu logunu kontrol edin' };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetExpiresAt: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Reset geçersiz veya süresi dolmuş');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        resetToken: null,
        resetExpiresAt: null,
      },
    });
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException('Refresh geçersiz');
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issueTokens(
      row.user.id,
      row.user.email,
      row.user.fullName,
      row.user.emailVerifiedAt,
    );
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
    return { ok: true };
  }

  private async assertNotRateLimited(email: string) {
    const since = new Date(Date.now() - 15 * 60_000);
    const fails = await this.prisma.loginAttempt.count({
      where: { email: email.toLowerCase(), ok: false, createdAt: { gt: since } },
    });
    if (fails >= 8) {
      throw new HttpException(
        'Çok fazla başarısız giriş — 15 dk sonra tekrar deneyin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async issueTokens(
    userId: string,
    email: string,
    fullName: string,
    emailVerifiedAt?: Date | null,
  ) {
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
      user: {
        id: userId,
        email,
        fullName,
        emailVerifiedAt: emailVerifiedAt ?? null,
      },
      accessToken,
      refreshToken: refreshRaw,
    };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
