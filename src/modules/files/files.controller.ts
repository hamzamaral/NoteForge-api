import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FilesService } from './files.service';

class UploadDto {
  @IsUUID()
  workspaceId!: string;
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDto,
  ) {
    if (!file?.buffer) throw new BadRequestException('Dosya gerekli');
    return this.files.upload(req.user.id, dto.workspaceId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });
  }
}
