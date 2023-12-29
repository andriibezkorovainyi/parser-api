import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { Alchemy, BlockWithTransactions, CoreNamespace } from 'alchemy-sdk';
import { IBlock, ITransactionResponse } from '../utils/types/interfaces';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractService } from '../contract/contract.service';
import * as assert from 'assert';
import { delay } from '../utils/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Network } from '../database/entities/network.entity';
import { Repository } from 'typeorm';
import {
  alchemyConfig,
  AlchemyReqPerSec,
  GenesisBlock,
  InstanceId,
  network,
} from '../settings/parser.settings';

@Injectable()
export class ParserService {
  private readonly alchemyCore: CoreNamespace;

  private isSynchronized: boolean;
  private isParsing = false;
  private network: Network;
  private readonly instanceId = InstanceId;

  constructor(
    @InjectPinoLogger(ParserService.name)
    private readonly logger: PinoLogger,
    private readonly cacheService: CacheService,
    private readonly contractService: ContractService,
    @InjectRepository(Network)
    private readonly networkRepository: Repository<Network>,
  ) {
    this.alchemyCore = new Alchemy(alchemyConfig).core;
  }

  async initialize() {
    this.network = await this.networkRepository.findOne({
      where: { name: network },
    });

    if (!this.network) {
      this.network = await this.networkRepository.save({ name: network });
    }

    this.processBlocks().catch((e) => this.logger.error(e));
  }

  async processBlocks() {
    const cachedBlocks = await this.cacheService.getProcessingBlockNumbers();

    if (cachedBlocks.length) {
      await this.processCachedBlocks(cachedBlocks);
    }

    await this.updateHeight();
  }

  async processCachedBlocks(blockNumbers: number[]) {
    this.logger.info('Called method --> processCachedBlocks');

    let blocks: IBlock[] = await this.getBlocks(blockNumbers);
    blocks = blocks.filter((block) => !block.isUnprocessed);

    const processedBlockNumbers = blocks.map(({ blockNumber }) => blockNumber);

    await this.contractService.saveContracts(blocks, this.network);

    await this.cacheService.removeProcessedBlockNumbers(processedBlockNumbers);

    const cachedBlocks = await this.cacheService.getUnprocessedBlocks();

    if (!cachedBlocks.length) {
      return;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateHeight() {
    if (this.instanceId !== 1) {
      return;
    }

    this.logger.info('Called method --> updateHeight');

    const networkHeight = await this.getNetworkHeight();
    this.logger.info(`Network height ${networkHeight}`);

    if (!networkHeight) {
      throw new Error('Unable to get most recent block number from network');
    }

    assert(
      (await this.cacheService.setNetworkHeight(networkHeight)) === 'OK',
      'Unable to set most recent block number to cache',
    );

    let pointerHeight = await this.cacheService.getPointerHeight();

    if (!pointerHeight) {
      const dbLatestBlock = await this.contractService.getLatestBlock();
      pointerHeight = dbLatestBlock || GenesisBlock;

      assert(
        (await this.cacheService.setPointerHeight(pointerHeight)) === 'OK',
        'Unable to set initial pointer height to cache',
      );
    }

    this.logger.info(`pointerHeight ${pointerHeight}`);

    this.isSynchronized = pointerHeight === networkHeight;

    if (!this.isSynchronized) {
      this.startBlockParsing();
    }
  }

  async startBlockParsing() {
    this.logger.info('Called method --> startParsing');

    if (this.isParsing) {
      return;
    }

    this.isParsing = true;

    while (!this.isSynchronized) {
      this.logger.info('startParsing --> while');

      const { pointer, incrementPointerBy, isSynchronized } =
        await this.cacheService.getNewPointerHeight();

      const blockNumbers = await this.getBlockNumbersToParse(
        pointer,
        incrementPointerBy,
      );

      await this.cacheService.setProcessingBlockNumbers(blockNumbers);

      this.isSynchronized = isSynchronized;

      let blocks: IBlock[] = await this.getBlocks(blockNumbers);
      blocks = blocks.filter((block) => !block.isUnprocessed);

      console.log(blocks[0].blockTimestamp);
      if (blocks.length === 0) {
        throw new Error('All blocks are null while fetching, check api limit');
      }

      const processedBlockNumbers = blocks.map(
        ({ blockNumber }) => blockNumber,
      );

      await this.contractService.saveContracts(blocks, this.network);

      await this.cacheService.removeProcessedBlockNumbers(
        processedBlockNumbers,
      );

      if (!this.isSynchronized) {
        this.logger.info('Parser service stopped');
      }
    }

    this.isParsing = false;
  }

  async getBlocks(blockNumbers: number[]): Promise<IBlock[]> {
    const blocks = [];

    for (let i = 0; i <= blockNumbers.length; i += AlchemyReqPerSec) {
      const promises: Promise<IBlock>[] = blockNumbers
        .slice(i, i + AlchemyReqPerSec)
        .map(
          (blockNumber) =>
            new Promise((resolve) => {
              resolve(this.getNetworkBlock(blockNumber));
            }),
        );

      this.logger.info(`getBlocks --> for ${i}`);
      blocks.push(...(await Promise.all(promises)));

      await delay();
    }

    return blocks;
  }

  async getNetworkBlock(blockNumber: number): Promise<IBlock> {
    const result = {
      blockNumber,
    } as IBlock;

    let block: BlockWithTransactions;

    try {
      block = await this.alchemyCore.getBlockWithTransactions(blockNumber);
      // block = await this.getBlock(blockNumber);
    } catch (error) {
      this.logger.error(error);

      if (error.status === 403) {
        throw new Error('Get blocks rate limit reached');
      }
    }

    if (!block) {
      result.isUnprocessed = true;

      return result;
    }

    result.blockTimestamp = block.timestamp;

    result.contracts = block.transactions.reduce(
      (acc, { creates, value }: ITransactionResponse) => {
        return creates ? [...acc, { creates, value }] : acc;
      },
      [],
    );

    return result;
  }

  async getNetworkHeight() {
    return this.alchemyCore.getBlockNumber();
  }

  async getBlockNumbersToParse(
    pointerHeight: number,
    incrementPointerBy: number,
  ): Promise<number[]> {
    return new Array(incrementPointerBy)
      .fill(0)
      .map((_, i) => pointerHeight + i);
  }
}
