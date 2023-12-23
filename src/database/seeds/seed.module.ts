import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import { DataSource } from 'typeorm';
import { TypeOrmConfigService } from '../typerom-config.service';
import { validate } from '../../utils/validators/environment.validator';
import { NetworkSeedModule } from './network/network-seed.module';
import { NetworkSeedService } from './network/network-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env.development.local', '.env.development', '.env'],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        return new DataSource(options).initialize();
      },
    }),
    NetworkSeedModule,
  ],
})
export class SeedModule {}
