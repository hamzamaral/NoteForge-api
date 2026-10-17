import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SharePermission } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SharesService } from './shares.service';

class CreateShareDto {
  @IsUUID()
  pageId!: string;

  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;
}

@Controller()
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post('shares')
  @UseGuards(JwtAuthGuard)
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateShareDto) {
    return this.shares.create(req.user.id, dto.pageId, dto.permission);
  }

  @Get('pages/:pageId/shares')
  @UseGuards(JwtAuthGuard)
  list(@Req() req: { user: { id: string } }, @Param('pageId') pageId: string) {
    return this.shares.list(req.user.id, pageId);
  }

  @Delete('shares/:id')
  @UseGuards(JwtAuthGuard)
  revoke(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.shares.revoke(req.user.id, id);
  }

  @Get('public/:token')
  publicGet(@Param('token') token: string) {
    return this.shares.publicGet(token);
  }
}
