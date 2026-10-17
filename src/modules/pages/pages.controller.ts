import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PagesService } from './pages.service';

class CreatePageDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;
}

class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

class BlockDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  type!: string;

  props!: object;

  @IsNumber()
  sortOrder!: number;

  @IsOptional()
  parentBlockId?: string | null;
}

class SaveBlocksDto {
  @IsNumber()
  expectedVersion!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks!: BlockDto[];

  @IsOptional()
  @IsArray()
  links?: { toPageId: string }[];
}

class ImportMdDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  markdown!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('workspaces/:workspaceId/pages')
  tree(
    @Req() req: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.pages.tree(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/trash')
  trash(
    @Req() req: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.pages.trash(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/search')
  search(
    @Req() req: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Query('q') q = '',
  ) {
    return this.pages.search(req.user.id, workspaceId, q);
  }

  @Post('pages')
  create(@Req() req: { user: { id: string } }, @Body() dto: CreatePageDto) {
    return this.pages.create(req.user.id, dto.workspaceId, dto);
  }

  @Get('pages/:id')
  get(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.pages.get(req.user.id, id);
  }

  @Patch('pages/:id')
  update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pages.updateMeta(req.user.id, id, dto);
  }

  @Delete('pages/:id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.pages.softDelete(req.user.id, id);
  }

  @Post('pages/:id/restore')
  restore(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.pages.restore(req.user.id, id);
  }

  @Patch('pages/:id/blocks')
  saveBlocks(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: SaveBlocksDto,
  ) {
    return this.pages.saveBlocks(
      req.user.id,
      id,
      dto.expectedVersion,
      dto.blocks,
      dto.links,
    );
  }

  @Get('pages/:id/export.md')
  exportMd(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.pages.exportMarkdown(req.user.id, id);
  }

  @Get('templates')
  templates() {
    return this.pages.listTemplates();
  }

  @Post('pages/import.md')
  importMd(@Req() req: { user: { id: string } }, @Body() dto: ImportMdDto) {
    return this.pages.importMarkdown(
      req.user.id,
      dto.workspaceId,
      dto.markdown,
      dto.title,
      dto.parentId,
    );
  }
}
