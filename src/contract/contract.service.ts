import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  IBlock,
  IContract,
  IVerifiedCodeData,
} from '../utils/types/interfaces';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { HttpService } from '@nestjs/axios';
import {
  ContractsBatch,
  Delay,
  EtherscanApiKey,
  EtherscanReqPerSec,
  network,
} from '../settings/parser.settings';
import { delay } from '../utils/helpers';
import { Repository } from 'typeorm';
import { Contract } from '../database/entities/contract.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';
import { writeFile, mkdir, access, unlink } from 'node:fs/promises';
import { Network } from '../database/entities/network.entity';
import { NetworkType } from '../utils/types/enums';
import axios, { AxiosInstance } from 'axios';
import { retry } from 'rxjs';

@Injectable()
export class ContractService {
  private isProcessing = false;
  private contracts: Contract[] = [];
  private axios: AxiosInstance;
  constructor(
    @InjectPinoLogger(ContractService.name)
    private readonly logger: PinoLogger,
    // private readonly httpService: HttpService,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Network)
    private readonly networkRepository: Repository<Network>,
  ) {
    this.axios = axios.create({
      baseURL: 'https://api.etherscan.io/api',
    });

    // this.httpService.axiosRef.defaults.baseURL = 'https://api.etherscan.io/api';
    // this.httpService.axiosRef.defaults.maxRate = EtherscanReqPerSec;
  }

  async processContracts() {
    this.logger.debug('Called method --> processContracts');

    if (this.isProcessing) {
      return;
    }

    while (true) {
      this.logger.debug('processContracts --> while');
      this.isProcessing = true;

      await this.getDBContracts();

      if (!this.contracts.length) {
        await delay();

        continue;
      }

      await this.collectBatchData();

      await this.saveBatchData();

      this.isProcessing = false;

      this.contracts = [];
    }
  }

  async collectBatchData() {
    const promises = this.contracts.map(
      (_, index) =>
        new Promise((resolve) => resolve(this.collectContractData(index))),
    );

    for (let i = 0; i < promises.length; i += EtherscanReqPerSec) {
      console.log('promises', promises.slice(i, i + EtherscanReqPerSec));
      console.log('i', i);
      this.logger.debug(`collectBatchData --> for ${0}`);

      await Promise.all(promises.slice(i, i + EtherscanReqPerSec));

      await delay();
    }
  }

  async collectContractData(contractIndex: number) {
    const contract = this.contracts[contractIndex];

    // const data = await this.getVerifiedCodeData(contract.address);
    let result = await this.getVerifiedCodeData(contract.address);
    result = await this.checkIsNeedRetry(result, contract.address, 0);

    if (!result) {
      contract.isProcessed = false;
      contract.isVerified = null;
      return;
    }

    const { SourceCode, ABI, ContractName } = result[0];

    console.log('ABI', ABI, 'ContractName', ContractName);

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
    const [verifiedI, unverifiedI] = this.contracts.reduce(
      (acc, contract, i) => {
        if (contract.isVerified) {
          acc[0].push(i);
        } else if (contract.isVerified === null) {
          acc[0].push(i);
        } else {
          acc[1].push(i);
        }

        return acc;
      },
      [[], []],
    );

    console.log(this.contracts);

    const allNull = this.contracts.every((c) => c.isVerified === null);

    console.log('allNull', allNull);
    const isAllDidntProcessed = allNull && unverifiedI.length > 5;

    if (isAllDidntProcessed) {
      throw new Error(
        'All requests to get verified code data failed. Most likely, the API key exceeded the limit.',
      );
    }

    await this.contractRepository.save(verifiedI.map((i) => this.contracts[i]));

    if (unverifiedI.length) {
      await this.contractRepository.delete(
        unverifiedI.map((i) => this.contracts[i].id),
      );
    }
  }

  async saveContractSourceCode(
    address: string,
    name: string,
    sourceCode: string,
  ): Promise<string> {
    const addressFormatted = address.slice(2);
    const prefix = addressFormatted.slice(0, 2);
    const baseDir = path.join(__dirname, '../../contracts');
    const prefixDir = path.join(baseDir, network, prefix);

    if (access(prefixDir).catch(() => false)) {
      await mkdir(prefixDir, { recursive: true });
    }

    const filePath = path.join(
      network,
      prefix,
      `${addressFormatted}_${name}.sol`,
    );

    await writeFile(path.join(baseDir, filePath), sourceCode);

    return filePath;
  }

  // async getVerifiedCodeData(
  //   address: string,
  // ): Promise<IVerifiedCodeData | null> {
  //   let result;
  //
  //   result = await this.getSourceCode(address);
  //   result = await this.checkIsNeedRetry(result, address, 0);
  //
  //   console.log('ITS A RESULT', result[0]);
  //
  //   return result ? result[0] : null;
  // }

  async checkIsNeedRetry(
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

    return await this.checkIsNeedRetry(result, address, counter + 1);
  }

  async retryGetSourceCode(address: string) {
    const result = null;
    const i = 0;

    return result;
  }

  async getVerifiedCodeData(
    address: string,
  ): Promise<[IVerifiedCodeData] | null> {
    try {
      const { data } = await this.axios.get('', {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address,
          apikey: EtherscanApiKey,
        },
      });

      console.log('data', data);

      return data.result;
    } catch (error) {
      this.logger.error(error);
    }

    return null;
  }

  async getDBContracts() {
    this.logger.debug('Called method --> getDBContracts');

    await this.contractRepository.manager.transaction(async (manager) => {
      this.contracts = await manager
        .createQueryBuilder(Contract, 'contract')
        .setLock('pessimistic_write')
        .where('contract.isProcessed = :isProcessed', { isProcessed: false })
        .limit(ContractsBatch)
        .getMany();

      this.contracts = this.contracts.map((c) => {
        c.isProcessed = true;

        return c;
      });

      await manager.save(Contract, this.contracts);
    });
  }

  async saveContracts(blocks: IBlock[]) {
    const contracts: IContract[] = await this.formatContracts(blocks);
    const _network = await this.networkRepository.findOne({
      where: { name: network },
    });

    await this.contractRepository.insert(
      contracts.map((c) =>
        this.contractRepository.create({
          address: c.address,
          blockNumber: c.blockNumber,
          blockTimestamp: new Date(c.blockTimestamp * 1000),
          network: _network,
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
}
