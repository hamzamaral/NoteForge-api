import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WorkspacesService } from './workspaces.service';

class CreateWsDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class InviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.workspaces.listForUser(req.user.id);
  }

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateWsDto) {
    return this.workspaces.create(req.user.id, dto.name);
  }

  @Get(':id/members')
  members(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.workspaces.members(req.user.id, id);
  }

  @Post(':id/invite')
  invite(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: InviteDto,
  ) {
    return this.workspaces.invite(req.user.id, id, dto.email, dto.role);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.workspaces.removeMember(req.user.id, id, userId);
  }
}
