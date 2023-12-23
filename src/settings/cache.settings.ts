import { RedisClientOptions } from '@liaoliaots/nestjs-redis';

export const RedisConfig = {
  host: 'localhost',
  port: 6379,
  db: 0,
} as RedisClientOptions;

export const RedisNumberRetries = 10;
