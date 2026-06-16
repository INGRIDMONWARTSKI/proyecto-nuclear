import { existsSync } from 'fs';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const allowedOrigins = new Set(['http://localhost:4200']);

  if (frontendUrl) {
    allowedOrigins.add(frontendUrl);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
  const publicDir = join(process.cwd(), 'public');
  const indexPath = join(publicDir, 'index.html');

  if (existsSync(indexPath)) {
    app.useStaticAssets(publicDir);
    const expressApp = app.getHttpAdapter().getInstance();

    expressApp.get(
      /^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/,
      (_req: Request, res: Response) => {
        res.sendFile(indexPath);
      },
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
