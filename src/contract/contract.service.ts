import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IGetBlockContractsResult } from '../utils/types/interfaces';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor() {} // private readonly contractRepository: ContractRepository,

  async saveContracts(blocksWithContracts: IGetBlockContractsResult[]) {
    for (const { contracts, blockNumber, blockTimestamp } of blocksWithContracts) {
      
    }
  }

  async getContractSourceCode(blockNumber: number) {
    return [];
  }
}
