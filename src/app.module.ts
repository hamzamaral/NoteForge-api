import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { PagesModule } from './modules/pages/pages.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DatabasesModule } from './modules/databases/databases.module';
import { SharesModule } from './modules/shares/shares.module';
import { CommentsModule } from './modules/comments/comments.module';
import { SyncModule } from './modules/sync/sync.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    PagesModule,
    TasksModule,
    DatabasesModule,
    SharesModule,
    CommentsModule,
    SyncModule,
    FilesModule,
    NotificationsModule,
    SearchModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    },
  ],
})
export class AppModule {}
