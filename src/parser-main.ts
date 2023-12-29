import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ParserModule } from './parser/parser.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ParserService } from './parser/parser.service';
import { ContractService } from './contract/contract.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CustomLoggerModule } from './config/custom-logger.module';

async function bootstrapParser() {
  const app = await NestFactory.create(ParserModule);

  // app.useLogger(app.get(Logger));
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

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
  await app.get(ContractService).initialize();
}
bootstrapParser();
