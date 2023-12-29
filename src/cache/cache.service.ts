import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';

import Redis from 'ioredis';
import { RedisNumberRetries } from '../settings/cache.settings';
import { BlocksBatch, InstanceId, network } from '../settings/parser.settings';
import { IGetParseToBlockResult } from '../utils/types/interfaces';
import { delay, isValidResult } from '../utils/helpers';
import { PinoLogger } from 'nestjs-pino';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class CacheService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: PinoLogger,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getNewPointerHeight(): Promise<IGetParseToBlockResult> {
    this.logger.debug('Called method --> getNewPointerHeight');

    const result = {} as IGetParseToBlockResult;

    Object.assign(result, await this.performTransaction());

    if (isValidResult(result)) {
      return result;
    }

    for (let i = 1; i < RedisNumberRetries + 1; i++) {
      this.logger.warn('Retry to set new pointer height in cache:', i);

      Object.assign(result, await this.performTransaction());

      if (isValidResult(result)) {
        break;
      }

      await delay();
    }

    return result;
  }

  async performTransaction(): Promise<IGetParseToBlockResult> {
    this.logger.debug('Called method --> performTransaction');

    const networkHeight = await this.getNetworkHeight();

    let pointer = NaN;
    let incrementPointerBy = BlocksBatch;
    let isSynchronized = false;

    await this.redis.watch(`${network}:pointerHeight`);

    pointer = await this.getPointerHeight();
    const newPointer = pointer + incrementPointerBy;

    if (newPointer > networkHeight) {
      incrementPointerBy = networkHeight - pointer;

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
      this.logger.error(error);

      incrementPointerBy = NaN;
      isSynchronized = false;
    } finally {
      await this.redis.unwatch();
    }

    return {
      pointer,
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
      this.logger.error(e);
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
      this.logger.error(e);
    }
  }

  async getProcessingBlockNumbers(): Promise<number[]> {
    this.logger.debug('Called method --> getProncessingBlockNumbers');

    const blockNumbers = await this.redis.lrange(
      `${network}:InstanceId${InstanceId}:processingBlockNumbers`,
      0,
      99,
    );

    return blockNumbers.map(Number);
  }

  async setProcessingBlockNumbers(blockNumbers: number[] | string[]) {
    this.logger.debug('Called method --> setProcessingBlockNumbers');

    await this.redis.rpush(
      `${network}:InstanceId${InstanceId}:processingBlockNumbers`,
      ...blockNumbers,
    );
  }

  async setProcessingContracts(contractIds: number[] | string[]) {
    this.logger.debug('Called method --> setProcessingContracts');

    await this.redis.rpush(
      `${network}:InstanceId${InstanceId}:processingContracts`,
      ...contractIds,
    );
  }

  async getProcessingContracts(): Promise<number[]> {
    this.logger.debug('Called method --> getProcessingContracts');

    const contractIds = await this.redis.lrange(
      `${network}:InstanceId${InstanceId}:processingContracts`,
      0,
      -1,
    );

    return contractIds.map(Number);
  }

  async removeProcessedContracts(contractIds: number[]) {
    this.logger.debug('Called method --> removeProcessedContracts');

    const cached = (
      await this.redis.lrange(
        `${network}:InstanceId${InstanceId}:processingContracts`,
        0,
        -1,
      )
    ).filter((contractId) => !contractIds.includes(Number(contractId)));

    await this.redis.del(
      `${network}:InstanceId${InstanceId}:processingContracts`,
    );

    if (!cached.length) {
      return;
    }

    await this.setProcessingContracts(cached);

    if (cached.length > 5000) {
      throw new Error('Cached contract ids less than 5000');
    }
  }

  async removeProcessedBlockNumbers(blockNumbers: number[]) {
    this.logger.debug('Called method --> removeProcessedBlockNumbers');

    const cached = (
      await this.redis.lrange(
        `${network}:InstanceId${InstanceId}:processingBlockNumbers`,
        0,
        -1,
      )
    ).filter((blockNumber) => !blockNumbers.includes(Number(blockNumber)));

    await this.redis.del(
      `${network}:InstanceId${InstanceId}:processingBlockNumbers`,
    );

    if (!cached.length) {
      return;
    }

    await this.setProcessingBlockNumbers(cached);

    if (cached.length > 5000) {
      throw new Error('Cached block numbers less than 5000');
    }
  }

  // async saveContracts(contracts: IBaseContract[]) {
  //   await this.redis.rpush(
  //     `${network}:InstanceId${InstanceId}:contracts`,
  //     ...JSON.stringify(contracts),
  //   );
  // }
}
