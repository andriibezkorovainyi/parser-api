import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { Observer, Subject, Subscription } from 'rxjs';
import {
  alchemyConfig,
  AlchemyReqPerSec,
  GenesisBlock,
} from '../constants/parser.constants';
import { CacheService } from '../cache/cache.service';
import { Alchemy, BlockWithTransactions, CoreNamespace } from 'alchemy-sdk';
import {
  IGetBlockContractsResult,
  ITransactionResponse,
} from '../utils/types/interfaces';
import { AxiosInstance } from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractService } from '../contract/contract.service';
import * as assert from 'assert';

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
    private readonly cacheService: CacheService,
    private httpService: HttpService,
    private readonly contractService: ContractService,
  ) {
    console.log(alchemyConfig);
    this.alchemyCore = new Alchemy(alchemyConfig).core;
  }

  async initialize() {
    await this.updateHeight();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateHeight() {
    this.logger.info('Called method --> updateHeight');

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
      this.startParsing();
    }
  }

  async startParsing() {
    this.logger.info('Called method --> startParsing');

    if (this.isParsing) {
      return;
    }

    this.isParsing = true;

    while (!this.isSynchronized) {
      this.logger.info('startParsing --> while');

      const { pointer, newPointer, incrementPointerBy, isSynchronized } =
        await this.cacheService.getNewPointerHeight();

      this.isSynchronized = isSynchronized;

      const blockNumbers = new Array(incrementPointerBy)
        .fill(0)
        .map((_, i) => pointer + i); // 100 quantity

      const blocksWithContracts = await this.getContractsForBlocks(
        blockNumbers,
        incrementPointerBy,
      ); //

      await this.checkUnprocessedBlocks(blocksWithContracts);

      console.log(blocksWithContracts);

      this.contractService.saveContracts(blocksWithContracts);
    }

    this.isParsing = false;
  }

  async getContractsForBlocks(blockNumbers: number[], count = 1000) {
    this.logger.info('Called method --> getContractsForBlocks');

    const contracts: IGetBlockContractsResult[] = [];

    const blockContractsPromises: Promise<IGetBlockContractsResult>[] =
      blockNumbers.map(
        (blockNumber) =>
          new Promise((resolve) => {
            resolve(this.getBlockContracts(blockNumber));
          }),
      );

    for (let i = 0; i <= count; i += AlchemyReqPerSec) {
      contracts.push(
        ...(await Promise.all(
          blockContractsPromises.slice(i, i + AlchemyReqPerSec),
        )),
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return contracts;
  }

  async checkUnprocessedBlocks(contracts: IGetBlockContractsResult[]) {
    const indexesToRemove: number[] = [];

    const unprocessedBlocks: number[] = contracts.reduce(
      (acc, { isBlockNull, blockNumber }, i) => {
        if (isBlockNull) {
          indexesToRemove.push(i);

          return [...acc, blockNumber];
        }

        return acc;
      },
      [],
    );

    if (unprocessedBlocks.length > 0) {
      try {
        await this.cacheService.setUnprocessedBlocks(unprocessedBlocks);
      } catch (e) {
        this.logger.error(
          `Error setting unprocessed blocks: ${e.message}`,
          unprocessedBlocks,
        );
      }

      if (unprocessedBlocks.length === contracts.length) {
        throw new Error('All blocks are null while');
      }

      for (let i = indexesToRemove.length - 1; i >= 0; i--) {
        contracts.splice(indexesToRemove[i], 1);
      }
    }

    return contracts;
  }

  async getBlockContracts(
    blockNumber: number,
  ): Promise<IGetBlockContractsResult> {
    this.logger.info('Called method --> getBlockContracts');

    const result = {
      blockNumber,
    } as IGetBlockContractsResult;

    let block: BlockWithTransactions;
    try {
      block = await this.alchemyCore.getBlockWithTransactions(blockNumber);
    } catch (error) {
      this.logger.error('Error getting block:', error);
    }

    if (!block) {
      result.isBlockNull = true;

      return result;
    }

    result.blockTimestamp = block.timestamp;

    result.contracts = block.transactions.reduce(
      (
        acc: Partial<ITransactionResponse>[],
        { creates, value }: ITransactionResponse,
      ) => {
        return creates ? [...acc, { creates, value }] : acc;
      },
      [],
    );

    return result;
  }

  async getNetworkHeight() {
    return this.alchemyCore.getBlockNumber();
  }
}
