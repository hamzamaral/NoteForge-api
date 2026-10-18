import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AdminService } from './modules/admin/admin.service';
import { NotificationsService } from './modules/notifications/notifications.service';

async function bootstrap() {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') === true },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  // Files: signed GET /api/v1/files/serve only (no public /uploads)
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });

  // Maintenance flag from SystemSetting
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.includes('/health') || req.path.includes('/admin/settings')) return next();
    try {
      const admin = app.get(AdminService);
      const row = await admin.getSetting('maintenance');
      const on = row && typeof row.value === 'object' && (row.value as { enabled?: boolean }).enabled;
      if (on && req.method !== 'GET') {
        return res.status(503).json({ message: 'Bakım modu — yazma kapalı' });
      }
    } catch {
      /* ignore */
    }
    return next();
  });

  const swagger = new DocumentBuilder()
    .setTitle('NoteForge API')
    .setDescription('Block-based notes, tasks, databases, sharing')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  logger.info(`NoteForge API http://localhost:${port}/api/v1`);

  // Local ops jobs (not prod cron SaaS)
  const admin = app.get(AdminService);
  const notifications = app.get(NotificationsService);
  setInterval(() => {
    void admin.purgeOldTrash(30).then((r) => {
      if (r.deleted) logger.info({ purged: r.deleted }, 'trash purge');
    });
    void notifications.remindDueTasks().then((r) => {
      if (r.reminded) logger.info({ reminded: r.reminded }, 'due reminders');
    });
  }, 60 * 60_000);
}

bootstrap();
