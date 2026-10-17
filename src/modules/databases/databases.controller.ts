import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DatabasesService } from './databases.service';

class CreateDbDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

@Controller('databases')
@UseGuards(JwtAuthGuard)
export class DatabasesController {
  constructor(private readonly databases: DatabasesService) {}

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateDbDto) {
    return this.databases.create(req.user.id, dto.workspaceId, dto.name);
  }

  @Get('by-page/:pageId')
  byPage(@Req() req: { user: { id: string } }, @Param('pageId') pageId: string) {
    return this.databases.byPage(req.user.id, pageId);
  }

  @Get(':id')
  get(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.databases.get(req.user.id, id);
  }

  @Post(':id/rows')
  addRow(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { values: Record<string, unknown> },
  ) {
    return this.databases.addRow(req.user.id, id, body.values || {});
  }

  @Patch('rows/:rowId')
  updateRow(
    @Req() req: { user: { id: string } },
    @Param('rowId') rowId: string,
    @Body() body: { values: Record<string, unknown> },
  ) {
    return this.databases.updateRow(req.user.id, rowId, body.values || {});
  }

  @Patch('views/:viewId')
  updateView(
    @Req() req: { user: { id: string } },
    @Param('viewId') viewId: string,
    @Body() body: { config: Record<string, unknown> },
  ) {
    return this.databases.updateView(req.user.id, viewId, body.config || {});
  }
}
