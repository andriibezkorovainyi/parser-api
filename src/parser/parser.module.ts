import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { validate } from '../utils/validators/environment.validator';
import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import pino from 'pino';
import { TypeOrmConfigService } from '../database/typerom-config.service';
import { ContractModule } from '../contract/contract.module';
import { ParserService } from './parser.service';
import { HttpModule } from '@nestjs/axios';
import { GatewayModule } from '../gateway/gateway.module';
import { CacheModule } from '../cache/cache.module';
import { ScheduleModule } from '@nestjs/schedule';

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
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        return new DataSource(options).initialize();
      },
    }),
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    CacheModule,
    ContractModule,
  ],
  providers: [ParserService],
})
export class ParserModule {}
