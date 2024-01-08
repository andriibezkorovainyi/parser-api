import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { HttpModule, HttpModuleOptions } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../database/entities/contract.entity';
import { Token } from '../database/entities/token.entity';
import { Network } from '../database/entities/network.entity';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    } as HttpModuleOptions),
    TypeOrmModule.forFeature([Contract, Token]),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
