import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';

import { RedlockService } from '@anchan828/nest-redlock';
import Redis from 'ioredis';
import { RedisNumberRetries } from '../constants/cache.constants';
import { BlocksBulk, network } from '../constants/parser.constants';
import { IGetParseToBlockResult } from '../utils/types/interfaces';
import { isValidResult } from '../utils/helpers';

@Injectable()
export class CacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly redlockService: RedlockService,
  ) {}

  async getNewPointer(): Promise<IGetParseToBlockResult> {
    const result = {} as IGetParseToBlockResult;

    Object.assign(result, await this.performTransaction());

    if (isValidResult(result)) {
      return result;
    }

    for (let i = 1; i < RedisNumberRetries + 1; i++) {
      console.log('Retry to retrieve data from Redis:', i);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      Object.assign(result, await this.performTransaction());

      if (isValidResult(result)) {
        break;
      }
    }

    return result;
  }

  async performTransaction(): Promise<IGetParseToBlockResult> {
    const networkHeight = await this.getNetworkHeight();

    let pointer = NaN;
    let newPointer = NaN;
    let incrementPointerBy = BlocksBulk;
    let isSynchronized = false;

    await this.redis.watch(`${network}:pointerHeight`);

    pointer = await this.getPointerHeight();
    newPointer = pointer + incrementPointerBy;

    if (newPointer > networkHeight) {
      incrementPointerBy = networkHeight - pointer;

      newPointer = networkHeight;

      isSynchronized = true;
    }

    const pipeline = this.redis.multi();

    pipeline.set(`${network}:pointerHeight`, newPointer);

    try {
      const [[error, result]] = await pipeline.exec();

      if (error) {
        throw error;
      }

      if (result !== 'OK') {
        throw new Error('Transaction to Redis is failed');
      }
    } catch (error) {
      console.log(error);

      incrementPointerBy = NaN;
      newPointer = NaN;
      isSynchronized = false;
    } finally {
      await this.redis.unwatch();
    }

    return {
      pointer,
      newPointer,
      isSynchronized,
      incrementPointerBy,
    };
  }

  async getPointerHeight(): Promise<number> {
    const blockNumber = await this.redis.get(`${network}:pointerHeight`);

    return Number(blockNumber);
  }

  async setPointerHeight(value: any) {
    return this.redis.set(
      `${network}:pointerHeight`,
      JSON.stringify(value, null, 2),
    );
  }

  async setUnprocessedBlocks(blockNumbers: number[]) {
    await this.redis.rpush(`${network}:unprocessedBlocks`, ...blockNumbers);
  }

  async getUnprocessedBlocks(): Promise<number[]> {
    const blockNumbers = await this.redis.lrange(
      `${network}:unprocessedBlocks`,
      0,
      -1,
    );

    return blockNumbers.map(Number);
  }

  async setNetworkHeight(blockNumber: number) {
    try {
      return this.redis.set(`${network}:networkHeight`, blockNumber);
    } catch (e) {
      console.log(e);
    }
  }

  async getNetworkHeight() {
    return Number(await this.redis.get(`${network}:networkHeight`));
  }

  async setIsSynchronized(value: boolean) {
    try {
      return this.redis.set(
        `${network}:networkHeight`,
        JSON.stringify(value, null, 2),
      );
    } catch (e) {
      console.log(e);
    }
  }
}
