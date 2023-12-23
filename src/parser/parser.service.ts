import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { Observer, Subject, Subscription } from 'rxjs';
import {
  alchemyConfig,
  AlchemyReqPerSec,
  alchemyRpcUrls,
  GenesisBlock,
  network,
} from '../settings/parser.settings';
import { CacheService } from '../cache/cache.service';
import { Alchemy, BlockWithTransactions, CoreNamespace } from 'alchemy-sdk';
import { IBlock, ITransactionResponse } from '../utils/types/interfaces';
import axios, { AxiosInstance } from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractService } from '../contract/contract.service';
import * as assert from 'assert';
import { delay } from '../utils/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Contract } from '../database/entities/contract.entity';
import { Repository, Timestamp } from 'typeorm';
import * as process from 'process';
import * as path from 'path';
import { toBigInt } from 'ethers';

@Injectable()
export class ParserService {
  // private readonly quickRpc: QNCoreClient;
  private readonly alchemyCore: CoreNamespace;

  private readonly isMasterProcess = true; // TODO из конфига
  private isSynchronized: boolean;
  private isParsing = false;

  constructor(
    @InjectPinoLogger(ParserService.name)
    private readonly logger: PinoLogger,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
    private readonly contractService: ContractService, // @InjectRepository(Contract) // private readonly contractRepository: Repository<Contract>,
  ) {
    this.alchemyCore = new Alchemy(alchemyConfig).core;
    this.httpService.axiosRef.defaults.baseURL = alchemyRpcUrls[network];
  }

  async initialize() {
    this.contractService.processContracts().catch((e) => this.logger.error(e));

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
    this.logger.debug('Called method --> processCachedBlocks');

    let blocks: IBlock[] = await this.getBlocks(blockNumbers);
    blocks = blocks.filter((block) => !block.isUnprocessed);

    const processedBlockNumbers = blocks.map(({ blockNumber }) => blockNumber);

    await this.contractService.saveContracts(blocks);

    await this.cacheService.removeProcessedBlockNumbers(processedBlockNumbers);

    const cachedBlocks = await this.cacheService.getUnprocessedBlocks();

    if (!cachedBlocks.length) {
      return;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateHeight() {
    this.logger.debug('Called method --> updateHeight');

    const networkHeight = await this.getNetworkHeight();
    console.log(networkHeight);

    if (!networkHeight) {
      throw new Error('Unable to get most recent block number from network');
    }

    assert(
      (await this.cacheService.setNetworkHeight(networkHeight)) === 'OK',
      'Unable to set most recent block number to cache',
    );

    let pointerHeight = await this.cacheService.getPointerHeight();
    console.log(pointerHeight);

    if (!pointerHeight) {
      pointerHeight = GenesisBlock;

      // TODO проверить высоту в базе
    }

    assert(
      (await this.cacheService.setPointerHeight(pointerHeight)) === 'OK',
      'Unable to set initial pointer height to cache',
    );

    this.isSynchronized = pointerHeight === networkHeight;

    if (!this.isSynchronized) {
      this.startBlockParsing();
    }
  }

  async startBlockParsing() {
    this.logger.debug('Called method --> startParsing');

    if (this.isParsing) {
      return;
    }

    this.isParsing = true;

    while (!this.isSynchronized) {
      this.logger.debug('startParsing --> while');

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

      await this.contractService.saveContracts(blocks);

      await this.cacheService.removeProcessedBlockNumbers(
        processedBlockNumbers,
      );
    }

    this.isParsing = false;
  }

  async getBlocks(blockNumbers: number[]): Promise<IBlock[]> {
    this.logger.debug('Called method --> getBlocks');

    const blocks = [];

    const promises: Promise<IBlock>[] = blockNumbers.map(
      (blockNumber) =>
        new Promise((resolve) => {
          resolve(this.getNetworkBlock(blockNumber));
        }),
    );

    for (let i = 0; i <= blockNumbers.length; i += AlchemyReqPerSec) {
      blocks.push(
        ...(await Promise.all(promises.slice(i, i + AlchemyReqPerSec))),
      );

      await delay();
    }

    return blocks;
  }

  async getNetworkBlock(blockNumber: number): Promise<IBlock> {
    this.logger.debug('Called method --> getBlock');

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

  async getBlock(blockNumber: number) {
    try {
      const res = await this.httpService.axiosRef.post('', {
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, true],
        id: 1,
      });

      console.log(res.data.result.transactions);
      return res.data.result;
    } catch (error) {
      this.logger.error(error);
    }
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
