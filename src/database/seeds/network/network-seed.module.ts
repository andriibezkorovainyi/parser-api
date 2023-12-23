import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Network } from '../../entities/network.entity';
import { NetworkSeedService } from './network-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Network])],
  providers: [NetworkSeedService],
  exports: [NetworkSeedService],
})
export class NetworkSeedModule {}
