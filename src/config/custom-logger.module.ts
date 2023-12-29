import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from '../utils/validators/environment.validator';
import appConfig from './app.config';
import databaseConfig from './database.config';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { writeFile } from 'node:fs/promises';
import * as path from 'path';
import { WinstonModule } from 'nest-winston';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local', '.env.development', '.env'],
      validate,
      load: [appConfig, databaseConfig],
    }),
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        // pinoHttp: {
        //   level: configService.get<string>('app.logLevel'),
        //   transport: {
        //     target: 'pino-pretty',
        //     options: {
        //       levelFirst: true,
        //       translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
        //       singleLine: true,
        //       colorize: true,
        //     },
        //   },
        //   stream:
        //     configService.get<string>('app.nodeEnv') === 'production'
        //       ? pino.destination({
        //           dest: configService.get<string>('app.logFile'),
        //           minLength: 4096,
        //           sync: false,
        //         })
        //       : undefined,
        // },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CustomLoggerModule {}
