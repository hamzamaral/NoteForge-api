import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsUUID } from 'class-validator';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FilesService } from './files.service';

class UploadDto {
  @IsUUID()
  workspaceId!: string;
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Signed GET — no JWT; HMAC query params required */
  @Get('serve')
  async serve(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!key || !exp || !sig) throw new BadRequestException('key/exp/sig gerekli');
    const out = await this.files.serve(key, exp, sig);
    res.setHeader('Content-Type', out.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if ('buffer' in out && out.buffer) {
      res.setHeader('Content-Length', out.size);
      return res.send(out.buffer);
    }
    const stream = (out as { stream: NodeJS.ReadableStream }).stream;
    stream.pipe(res);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
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
