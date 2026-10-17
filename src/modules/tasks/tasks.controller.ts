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
import { Allow, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TasksService } from './tasks.service';

class CreateTaskDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** YYYY-MM-DD or ISO; null clears the date */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  dueAt?: string | null;

  @IsOptional()
  @Allow()
  pageId?: string | null;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Req() req: { user: { id: string } },
    @Query('workspaceId') workspaceId: string,
    @Query('pageId') pageId?: string,
  ) {
    return this.tasks.list(req.user.id, workspaceId, pageId);
  }

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.tasks.remove(req.user.id, id);
  }
}
