import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class RegisterDto extends LoginDto {
  @IsString()
  @MinLength(2)
  fullName!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class ResetRequestDto {
  @IsEmail()
  email!: string;
}

class ResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.fullName);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: { ip?: string; headers: Record<string, string> }) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('password/forgot')
  forgot(@Body() dto: ResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { id: string } }) {
    return this.auth.me(req.user.id);
  }
}
