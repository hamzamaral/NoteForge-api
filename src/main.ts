import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') === true },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
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
}

bootstrap();
