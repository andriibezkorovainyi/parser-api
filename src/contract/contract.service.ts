import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  IBlock,
  IContract,
  IContractBalanceData,
  ITokenBalance,
  IVerifiedCodeData,
} from '../utils/types/interfaces';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { HttpService } from '@nestjs/axios';
import {
  alchemyConfig,
  AlchemyReqPerSec,
  apiCredentials,
  ContractsBatch,
  Delay,
  EtherscanReqPerSec,
  network,
  quickNConfig,
  QuickNodeNumberRetries,
  QuickNodeReqPerSec,
  TokensBatch,
} from '../settings/parser.settings';
import { delay, parseBalance, truncateDecimal } from '../utils/helpers';
import { Repository } from 'typeorm';
import { Contract } from '../database/entities/contract.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';
import { writeFile, mkdir, access, unlink, readFile } from 'node:fs/promises';
import { Network } from '../database/entities/network.entity';
import { firstValueFrom, retry } from 'rxjs';
import { Alchemy, CoreNamespace } from 'alchemy-sdk';
import { ethers } from 'ethers';
import { Core, QNCoreClient } from '@quicknode/sdk';
import { CacheService } from '../cache/cache.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Token } from '../database/entities/token.entity';
import { TokenService } from '../token/token.service';

@Injectable()
export class ContractService {
  private readonly instanceId = process.env.INSTANCE_ID;
  private isProcessing = false;
  private contracts: Contract[] = [];

  private readonly quickNode: QNCoreClient;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly tokenService: TokenService,
  ) {
    this.quickNode = new Core(quickNConfig).client;
  }

  async initialize() {
    // await this.tokenService.processTokenHoldingsToTokens();

    await this.processContractsWithoutBalance();

    this.tokenService.initialize();

    await this.processCachedContracts();

    this.processContracts();
  }

  async processCachedContracts() {
    this.logger.debug('Called method --> processCachedContracts');

    const cachedContractIds = await this.cacheService.getProcessingContracts();

    if (!cachedContractIds || cachedContractIds.length == 0) {
      return;
    }

    const contracts = await this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.id IN (:...ids)', { ids: cachedContractIds })
      .getMany();

    for (let i = 0; i < contracts.length; i += EtherscanReqPerSec) {
      this.contracts = contracts.slice(i, i + EtherscanReqPerSec);

      await this.performRequests();

      await this.saveBatchData();

      await delay();
    }

    this.contracts = [];

    await this.removeProcessedContracts(cachedContractIds);
  }

  private async processContracts() {
    this.logger.debug('Called method --> processContracts');

    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.isProcessing) {
      this.logger.debug('processContracts --> while');

      await this.getDBContracts();

      if (this.contracts.length == 0) {
        await delay(10_000);

        continue;
      }

      await this.setProcessingContracts();

      await this.performRequests();

      await this.saveBatchData();

      await this.removeProcessedContracts();

      const isAllDidntProcessed =
        this.contracts.length > 0
          ? this.contracts.every((c) => c.isVerified === null)
          : false;

      if (isAllDidntProcessed) {
        throw new Error(
          'All requests to get verified code data failed. Most likely, the API key exceeded the limit.',
        );
      }

      this.contracts = [];

      await delay(1000);
    }
  }

  async removeProcessedContracts(contractIds?: number[]) {
    await this.cacheService.removeProcessedContracts(
      contractIds || this.contracts.map((c) => c.id),
    );
  }

  async setProcessingContracts() {
    const contractIds = this.contracts.map((c) => c.id);

    await this.cacheService.setProcessingContracts(contractIds);
  }

  async performRequests() {
    for (let i = 0; i < this.contracts.length; i += EtherscanReqPerSec) {
      const take = i + EtherscanReqPerSec;

      const promises = this.contracts
        .slice(i, take)
        .map(
          (_, index) =>
            new Promise((resolve) =>
              resolve(this.collectVerifiedCodeData(index)),
            ),
        );

      await Promise.all(promises);

      if (take < this.contracts.length) {
        await delay();
      }
    }

    const verifiedContracts = this.contracts.filter((c) => c.isVerified);

    for (let i = 0; i < verifiedContracts.length; i += QuickNodeReqPerSec) {
      const take = i + QuickNodeReqPerSec;

      const promises = verifiedContracts
        .slice(i, take)
        .map(
          (contract) =>
            new Promise((resolve) =>
              resolve(this.collectBalanceData(contract)),
            ),
        );

      await Promise.allSettled(promises);

      if (take < verifiedContracts.length) {
        await delay();
      }
    }
  }

  async collectBalanceData(contract: Contract) {
    this.logger.debug('called method --> collectBalanceData');

    if (contract.balance !== null) {
      return;
    }

    let data = await this.getContractBalanceData(contract.address);
    data = await this.checkContractBalanceNeedRetry(data, contract.address, 0);

    if (!data) {
      return;
    }

    const { nativeTokenBalance, result } = data;

    contract.balance = truncateDecimal(nativeTokenBalance);

    const tokens = result.map(
      ({ name, totalBalance, address, decimals }) =>
        new Token({
          name,
          address,
          balance: parseBalance(totalBalance, decimals),
          contract: contract,
        }),
    );

    await this.tokenService.insert(tokens);
  }

  async checkContractBalanceNeedRetry(
    result: IContractBalanceData | null,
    address: string,
    counter: number,
  ) {
    if (counter > QuickNodeNumberRetries) {
      return result;
    }

    if (result && result.nativeTokenBalance && result.result) {
      return result;
    }

    this.logger.error('Retry getContractBalanceData');

    await delay(3000);

    result = await this.getContractBalanceData(address);

    return await this.checkContractBalanceNeedRetry(
      result,
      address,
      counter + 1,
    );
  }

  async getContractBalanceData(
    contractAddress: string,
  ): Promise<IContractBalanceData | null> {
    let result = null;

    try {
      result = await this.quickNode.qn_getWalletTokenBalance({
        wallet: contractAddress as `0x${string}`,
        perPage: 100,
      });
    } catch (error) {
      this.logger.error(error);
    }

    return result;
  }

  async collectVerifiedCodeData(contractIndex: number) {
    this.logger.debug('Called method --> collectVerifiedCodeData');
    const contract = this.contracts[contractIndex];

    if (contract.isVerified !== null) {
      contract.isProcessed = true;
      return;
    }

    let result = await this.getVerifiedCodeData(contract.address);
    result = await this.checkVerifiedCodeNeedRetry(result, contract.address, 0);

    if (!result) {
      contract.isProcessed = false;
      contract.isVerified = null;
      return;
    }

    const { SourceCode, ABI, ContractName } = result[0];

    if (ABI.startsWith('Contract source code not verified')) {
      contract.isVerified = false;
      return;
    }

    contract.isVerified = true;
    contract.name = ContractName;

    contract.filePath = await this.saveContractSourceCode(
      contract.address,
      ContractName,
      SourceCode,
    );
  }

  async saveBatchData() {
    await this.contractRepository.save(this.contracts);
    // const [verifiedI, unverifiedI] = this.contracts.reduce(
    //   (acc, contract, i) => {
    //     if (contract.isVerified) {
    //       acc[0].push(i);
    //     } else if (contract.isVerified === null) {
    //       acc[0].push(i);
    //     } else {
    //       acc[1].push(i);
    //     }
    //
    //     return acc;
    //   },
    //   [[], []],
    // );
    //
    // await this.contractRepository.save(verifiedI.map((i) => this.contracts[i]));
    //
    // if (unverifiedI.length) {
    //   await this.contractRepository.delete(
    //     unverifiedI.map((i) => this.contracts[i].id),
    //   );
    // }
  }

  async saveContractSourceCode(
    address: string,
    name: string,
    sourceCode: string,
  ): Promise<string> {
    const addressFormatted = address.slice(2).toLowerCase();
    const prefix = addressFormatted.slice(0, 2).toLowerCase();
    const baseDir = path.join(__dirname, '../../contracts');
    const prefixDir = path.join(baseDir, network.toLowerCase(), prefix);

    if (access(prefixDir).catch(() => false)) {
      await mkdir(prefixDir, { recursive: true });
    }

    const filePath = path.join(
      network.toLowerCase(),
      prefix,
      `${addressFormatted}_${name}.sol`,
    );

    await access(path.join(baseDir, filePath)).catch(
      async () => await writeFile(path.join(baseDir, filePath), sourceCode),
    );

    return filePath;
  }

  async checkVerifiedCodeNeedRetry(
    result: [IVerifiedCodeData] | string | null,
    address: string,
    counter: number,
  ) {
    if (counter > 5) {
      return result;
    }

    if (result && typeof result === 'object') {
      return result;
    }

    this.logger.error(result || 'Result of getSourceCode is null');

    await delay();

    result = await this.getVerifiedCodeData(address);

    return await this.checkVerifiedCodeNeedRetry(result, address, counter + 1);
  }

  async getVerifiedCodeData(
    address: string,
  ): Promise<[IVerifiedCodeData] | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://api.etherscan.io/api', {
          params: {
            module: 'contract',
            action: 'getsourcecode',
            address,
            apikey: apiCredentials.etherscanApiKey,
          },
        }),
      );

      return response.data.result;
    } catch (error) {
      this.logger.error(error.message);
    }

    return null;
  }

  async getDBContracts() {
    this.logger.debug('Called method --> getDBContracts');

    try {
      await this.contractRepository.manager.transaction(async (manager) => {
        this.contracts = await manager
          .createQueryBuilder(Contract, 'contract')
          .setLock('pessimistic_write')
          .where('contract.isProcessed = :isProcessed', { isProcessed: false })
          .limit(ContractsBatch)
          .getMany();

        this.contracts.forEach((c) => {
          c.isProcessed = true;
        });

        await manager.save(Contract, this.contracts);
      });
    } catch (error) {
      this.logger.error(error);

      this.contracts = [];
    }
  }

  async saveContracts(blocks: IBlock[], network: Network) {
    const contracts: IContract[] = await this.formatContracts(blocks);

    await this.contractRepository.insert(
      contracts.map((c) =>
        this.contractRepository.create({
          address: c.address,
          blockNumber: c.blockNumber,
          blockTimestamp: new Date(c.blockTimestamp * 1000),
          network,
        }),
      ),
    );
  }

  async formatContracts(blocks: IBlock[]): Promise<Array<IContract>> {
    return blocks.reduce((acc, block) => {
      if (!block.contracts || block.isUnprocessed) {
        return acc;
      }

      const _contracts = block.contracts.map(({ creates, value }) => ({
        address: creates,
        balance: value,
        blockNumber: block.blockNumber,
        blockTimestamp: block.blockTimestamp,
      }));

      return [...acc, ..._contracts];
    }, []);
  }

  async getLatestBlock(): Promise<number> {
    const latestContract = await this.contractRepository
      .createQueryBuilder('contract')
      .orderBy('contract.blockNumber', 'DESC')
      .getOne();

    return latestContract ? latestContract.blockNumber : 0;
  }

  async processContractsWithoutBalance() {
    if (Number(this.instanceId) !== 1) {
      return;
    }

    this.logger.debug('Called method --> processContractsWithoutBalance');
    const count = await this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.balance is null')
      .andWhere('contract.isVerified = :isVerified', { isVerified: true })
      .getCount();

    for (let i = 0; i < count; i += QuickNodeReqPerSec) {
      const contracts = await this.contractRepository
        .createQueryBuilder('contract')
        .select(['contract.id', 'contract.address', 'contract.balance'])
        .where('contract.balance IS NULL')
        .andWhere('contract.isVerified = TRUE')
        .take(QuickNodeReqPerSec)
        .getMany();

      if (contracts.length == 0) {
        break;
      }

      await Promise.allSettled(
        contracts.map(
          (c) => new Promise((resolve) => resolve(this.collectBalanceData(c))),
        ),
      );

      await this.contractRepository.save(contracts);

      await delay(1000);
    }

    this.logger.debug('Finished processing contracts without balance');
  }
}
