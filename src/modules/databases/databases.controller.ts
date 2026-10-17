import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DatabasesService } from './databases.service';

class CreateDbDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class AddPropertyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsArray()
  options?: string[];
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

  @Post(':id/properties')
  addProperty(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: AddPropertyDto,
  ) {
    return this.databases.addProperty(req.user.id, id, dto);
  }

  @Post(':id/rows')
  addRow(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { values?: Record<string, unknown> },
  ) {
    return this.databases.addRow(req.user.id, id, body.values || {});
  }

  @Delete('properties/:propertyId')
  deleteProperty(
    @Req() req: { user: { id: string } },
    @Param('propertyId') propertyId: string,
  ) {
    return this.databases.deleteProperty(req.user.id, propertyId);
  }

  @Patch('rows/:rowId')
  updateRow(
    @Req() req: { user: { id: string } },
    @Param('rowId') rowId: string,
    @Body() body: { values: Record<string, unknown> },
  ) {
    return this.databases.updateRow(req.user.id, rowId, body.values || {});
  }

  @Delete('rows/:rowId')
  deleteRow(@Req() req: { user: { id: string } }, @Param('rowId') rowId: string) {
    return this.databases.deleteRow(req.user.id, rowId);
  }

  @Patch('views/:viewId')
  updateView(
    @Req() req: { user: { id: string } },
    @Param('viewId') viewId: string,
    @Body() body: { config?: Record<string, unknown>; name?: string },
  ) {
    return this.databases.updateView(req.user.id, viewId, body);
  }

  @Get(':id')
  get(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.databases.get(req.user.id, id);
  }

  @Patch(':id')
  rename(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.databases.rename(req.user.id, id, body.name);
  }
}
