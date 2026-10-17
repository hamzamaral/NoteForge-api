import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CommentsService } from './comments.service';

class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsUUID()
  blockId?: string;
}

@Controller('pages/:pageId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }, @Param('pageId') pageId: string) {
    return this.comments.list(req.user.id, pageId);
  }

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Param('pageId') pageId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(req.user.id, pageId, dto.body, dto.blockId);
  }

  @Delete(':id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.comments.remove(req.user.id, id);
  }
}
