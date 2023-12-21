import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ParserModule } from './parser/parser.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ParserService } from './parser/parser.service';

async function bootstrapParser() {
  const app = await NestFactory.create(ParserModule);

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidUnknownValues: true,
    }),
  );

  await app.get(ParserService).initialize();

  const configService = app.get(ConfigService);
}
bootstrapParser();
