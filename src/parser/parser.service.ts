import { QNCoreClient } from '@quicknode/sdk';
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

@Injectable()
export class ParserService {
  // private readonly quickRpc: QNCoreClient;
  private readonly alchemyCore: CoreNamespace;

  private syncSubject: Subject<boolean>;
  private syncSubscription: Subscription;

  private readonly isMasterProcess = true; // TODO из конфига
  private isSynchronized = false;

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
    this.subscribeSyncing();

    await this.updateHeight();
  }

  subscribeSyncing() {
    const observer: Observer<boolean> = {
      next: async (isSync) => {
        this.isSynchronized = isSync;

        if (!isSync) {
          this.startParsing();
        }
      },
      error: (e) => this.logger.error(e),
      complete: () => this.logger.info('Sync subscription completed'),
    };

    this.syncSubject?.complete();
    this.syncSubject = new Subject<boolean>();

    this.syncSubscription?.unsubscribe();
    this.syncSubscription = this.syncSubject.subscribe(observer);

    this.syncSubscription.add(() => {
      setTimeout(() => {
        this.logger.warn(`try reconnect subscribeCommonMessage`);
        this.subscribeSyncing();
      }, 5000);
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateHeight() {
    // if (!this.isMasterProcess) {
    //   return;
    // }

    const networkHeight = await this.getNetworkHeight();

    if (!networkHeight) {
      throw new Error('Unable to get most recent block number from network');
    }

    const setResult = await this.cacheService.setNetworkHeight(networkHeight);

    if (setResult !== 'OK') {
      throw new Error('Unable to set most recent block number to cache');
    }

    const pointerHeight = await this.cacheService.getPointerHeight();

    if (!pointerHeight) {
      // TODO проверить высоту в базе
      await this.cacheService.setPointerHeight(GenesisBlock);
    }

    // TODO запустить парсинг
  }

  async startParsing() {
    while (!this.isSynchronized) {
      const { pointer, newPointer, incrementPointerBy, isSynchronized } =
        await this.cacheService.getNewPointer();

      if (isSynchronized) {
        this.syncSubject.next(true);
      }

      const blockNumbers = new Array(incrementPointerBy)
        .fill(0)
        .map((_, i) => pointer + i); // 100 quantity

      const blocksWithContracts = await this.getContractsForBlocks(
        blockNumbers,
        incrementPointerBy,
      ); //

      await this.checkUnprocessedBlocks(blocksWithContracts);

      this.contractService.saveContracts(blocksWithContracts);
    }
  }

  async getContractsForBlocks(blockNumbers: number[], count = 1000) {
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
      await this.cacheService.setUnprocessedBlocks(unprocessedBlocks);

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
    try {
      return this.alchemyCore.getBlockNumber();
    } catch (error) {
      this.logger.error('Error getting block number:', error);
    }
  }
}
