import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PagesModule } from '../pages/pages.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule, WorkspacesModule, PagesModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
