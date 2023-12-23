import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IBlock, IContract } from '../utils/types/interfaces';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { HttpService } from '@nestjs/axios';
import {
  ContractsButch,
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

@Injectable()
export class ContractService {
  private isFetching = false;

  constructor(
    @InjectPinoLogger(ContractService.name)
    private readonly logger: PinoLogger,
    private readonly httpService: HttpService,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Network)
    private readonly networkRepository: Repository<Network>,
  ) {
    this.httpService.axiosRef.defaults.baseURL = 'https://api.etherscan.io/api';
  } // private readonly contractRepository: ContractRepository,

  @Cron(CronExpression.EVERY_MINUTE)
  async processContracts() {
    if (this.isFetching) {
      return;
    }

    this.isFetching = true;

    const contracts = await this.getDBContracts();
    // console.log(contracts);

    const promises: Promise<Contract>[] = contracts.map(
      (c) => new Promise((resolve) => resolve(this.collectContractData(c))),
    );

    for (let i = 0; i < promises.length; i += EtherscanReqPerSec) {
      contracts.splice(
        i,
        EtherscanReqPerSec,
        ...(await Promise.all(promises.slice(i, i + EtherscanReqPerSec))),
      );

      await delay();
    }

    const [verifiedIndeces, unverifiedIndeces] = contracts.reduce(
      (acc, c, i) => {
        if (c.isVerified) {
          acc[0].push(i);
        } else {
          acc[1].push(i);
        }

        return acc;
      },
      [[], []],
    );

    await this.contractRepository.save(
      verifiedIndeces.map((i) => contracts[i]),
    );

    if (unverifiedIndeces.length) {
      await this.contractRepository.delete(
        unverifiedIndeces.map((i) => contracts[i].id),
      );
    }
  }

  async getDBContracts(): Promise<Contract[]> {
    let contracts = [];

    await this.contractRepository.manager.transaction(async (manager) => {
      contracts = await manager
        .createQueryBuilder(Contract, 'contract')
        .setLock('pessimistic_write')
        .where('contract.isProcessed = :isProcessed', { isProcessed: false })
        .andWhere('contract.isVerified = :isVerified', { isVerified: null })
        .limit(ContractsButch)
        .getMany();

      await manager.save(
        Contract,
        contracts.map((c) => {
          return {
            id: c.id,
            isProcessed: true,
          };
        }),
      );
    });

    return contracts;
  }

  async collectContractData(contract: Contract): Promise<Contract> {
    // console.log(contract);
    const { SourceCode, ABI, ContractName } = await this.getVerifiedCodeData(
      contract.address,
    );
    // console.log(contract);
    if (ABI === 'Contract source code not verified') {
      contract.isVerified = false;
      return contract;
    }

    contract.isVerified = true;

    contract.name = ContractName;

    contract.filePath = await this.saveContractSourceCode(
      contract.address,
      ContractName,
      SourceCode,
    );

    return contract;
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

  async getVerifiedCodeData(address: string): Promise<any> {
    let response;

    try {
      response = await this.httpService.axiosRef.get('', {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address,
          apikey: EtherscanApiKey,
        },
      });
    } catch (error) {
      if (error.response.data.result.status === 403) {
      }
      console.log(error);
    }

    return response.data.result[0];
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
}
