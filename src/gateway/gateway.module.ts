import { Module } from '@nestjs/common';
import { WebsocketClient } from './websocket.client';
import { CacheModule } from '../parser/cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [WebsocketClient],
})
export class GatewayModule {}
