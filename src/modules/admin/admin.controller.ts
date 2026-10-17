import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsObject, IsString } from 'class-validator';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminService } from './admin.service';

class SettingDto {
  @IsString()
  key!: string;

  @IsObject()
  value!: object;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('workspaces/:workspaceId/audit')
  audit(@Req() req: { user: { id: string } }, @Param('workspaceId') workspaceId: string) {
    return this.admin.audit(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/export')
  export(@Req() req: { user: { id: string } }, @Param('workspaceId') workspaceId: string) {
    return this.admin.exportWorkspace(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/export.zip')
  async exportZip(
    @Req() req: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Res() res: Response,
  ) {
    const buf = await this.admin.exportWorkspaceZip(req.user.id, workspaceId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="noteforge-${workspaceId.slice(0, 8)}.zip"`,
    );
    res.send(buf);
  }

  @Get('settings/:key')
  getSetting(@Param('key') key: string) {
    return this.admin.getSetting(key);
  }

  @Post('settings')
  setSetting(@Req() req: { user: { id: string } }, @Body() dto: SettingDto) {
    return this.admin.setSetting(req.user.id, dto.key, dto.value);
  }

  @Post('jobs/purge-trash')
  purge() {
    return this.admin.purgeOldTrash(30);
  }
}
