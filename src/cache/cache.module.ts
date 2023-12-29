import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { RedisConfig } from '../settings/cache.settings';
import { CacheService } from './cache.service';

@Module({
  imports: [
    RedisModule.forRoot({
      config: RedisConfig,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
