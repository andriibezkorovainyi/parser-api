import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { HttpModule, HttpModuleOptions } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../database/entities/contract.entity';
import { Network } from '../database/entities/network.entity';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    } as HttpModuleOptions),
    TypeOrmModule.forFeature([Contract, Network]),
    CacheModule,
  ],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
