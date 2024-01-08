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
import { CustomLoggerModule } from '../config/custom-logger.module';
import { CacheService } from '../cache/cache.service';
import { HttpModuleOptions } from '@nestjs/axios';
import { Contract } from '../database/entities/contract.entity';
import { Network } from '../database/entities/network.entity';
import { Token } from '../database/entities/token.entity';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [
    CustomLoggerModule,
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        return new DataSource(options).initialize();
      },
    }),
    TypeOrmModule.forFeature([Network]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    } as HttpModuleOptions),
    ScheduleModule.forRoot(),
    CacheModule,
    ContractModule,
    TokenModule,
  ],
  providers: [ParserService],
})
export class ParserModule {}
