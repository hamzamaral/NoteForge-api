import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SearchService } from './search.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('workspaces/:workspaceId/search')
  searchWs(
    @Req() req: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Query('q') q = '',
    @Query('kind') kind?: string,
  ) {
    return this.search.search(req.user.id, workspaceId, q, kind);
  }

  @Post('workspaces/:workspaceId/search/reindex')
  reindex(@Req() req: { user: { id: string } }, @Param('workspaceId') workspaceId: string) {
    return this.search.reindexWorkspace(req.user.id, workspaceId);
  }
}
