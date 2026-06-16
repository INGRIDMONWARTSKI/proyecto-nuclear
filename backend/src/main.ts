import { existsSync } from 'fs';
import { extname } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

const STATIC_ASSET_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
  '.json',
  '.txt',
  '.webmanifest',
]);

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
    prefix: '/uploads/',
  });
  const publicDir = join(process.cwd(), 'public');
  const indexPath = join(publicDir, 'index.html');

  if (existsSync(indexPath)) {
    app.useStaticAssets(publicDir, {
      index: false,
    });

    const expressApp = app.getHttpAdapter().getInstance();

    expressApp.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }

      const requestPath = req.path || '/';
      if (requestPath.startsWith('/api') || requestPath.startsWith('/uploads')) {
        next();
        return;
      }

      const extension = extname(requestPath).toLowerCase();
      if (extension && STATIC_ASSET_EXTENSIONS.has(extension)) {
        res.status(404).end();
        return;
      }

      res.sendFile(indexPath, (error) => {
        if (error) {
          next(error);
        }
      });
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
