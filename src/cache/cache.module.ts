import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { RedisConfig } from '../constants/cache.constants';
import { RedlockModule } from '@anchan828/nest-redlock';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    RedisModule.forRoot({
      config: RedisConfig,
    }),
    // RedlockModule.register({
    //   clients: [new Redis(RedisConfig)],
    //   settings: {
    //     driftFactor: 0.01,
    //     retryCount: 10,
    //     retryDelay: 200,
    //     retryJitter: 200,
    //     automaticExtensionThreshold: 500,
    //   },
    //   // Default duratiuon to use with Redlock decorator
    //   duration: 1000,
    // }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
