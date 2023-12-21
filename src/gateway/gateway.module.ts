import { Module } from '@nestjs/common';
import { CacheModule } from '..//cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [],
})
export class GatewayModule {}
