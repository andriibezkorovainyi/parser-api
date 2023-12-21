import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from '../utils/validators/environment.validator';
import appConfig from './app.config';
import databaseConfig from './database.config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local', '.env.development', '.env'],
      validate,
      load: [appConfig, databaseConfig],
    }),
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('app.logLevel'),
          transport: {
            target: 'pino-pretty',
            options: {
              levelFirst: true,
              translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
              singleLine: true,
              colorize: true,
            },
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CustomLoggerModule {}
