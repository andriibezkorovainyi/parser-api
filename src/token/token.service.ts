import { Inject, Injectable, Logger } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Token } from '../database/entities/token.entity';
import { Repository } from 'typeorm';
import { Contract } from '../database/entities/contract.entity';
import { delay, truncateDecimal } from '../utils/helpers';
import { network, TokensBatch } from '../settings/parser.settings';
import { ITokenPrice } from '../utils/types/interfaces';
import { firstValueFrom } from 'rxjs';
import { NetworkType } from '../utils/types/enums';
import { Network } from '../database/entities/network.entity';
import { log } from 'winston';
import * as process from 'process';

function getNetworkName() {
  switch (network) {
    case NetworkType.ETH:
      return 'ethereum';
  }
}

@Injectable()
export class TokenService {
  private tokenAddresses: string[] = [];
  private tokenIds: number[] = [];
  private contractIds: number[] = [];
  private tokenPrices: { address: string; price: number }[] = [];
  private readonly instanceId = process.env.INSTANCE_ID;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {
    this.httpService.axiosRef.defaults.baseURL = 'https://api.portals.fi/v2/';
    this.httpService.axiosRef.defaults.headers['Authorization'] =
      process.env.PORTALS_TOKEN;
  }

  async initialize() {
    if (Number(this.instanceId) !== 1) {
      return;
    }

    this.processContractTokens();
  }

  async processContractTokens() {
    while (true) {
      await this.getContractsWithoutUSDBalance();

      if (this.contractIds.length == 0) {
        this.clearVariables();

        await delay(20000);
        continue;
      }

      await this.collectPriceData();

      if (!this.tokenPrices) {
        this.logger.error(
          'Failed to get token prices. Stopping processContractTokens...',
        );
        this.clearVariables();
        break;
      }

      await this.updateTokenBalanceUSD();

      await this.updateContractTokenBalanceUSD();

      await delay(3000);
    }
  }

  clearVariables() {
    this.contractIds = [];
    this.tokenAddresses = [];
    this.tokenIds = [];
    this.tokenPrices = [];
  }

  async getContractsWithoutUSDBalance() {
    this.logger.log('Called method --> getContractsWithoutUSDBalance');

    let contracts: Contract[] = [];

    try {
      contracts = await this.contractRepository
        .createQueryBuilder('contract')
        .select('contract.id')
        .where('contract.isVerified = :isVerified', { isVerified: true })
        .andWhere('contract.tokenBalanceUSD is null')
        .leftJoin('contract.tokens', 'tokens')
        .addSelect(['tokens.address', 'tokens.id'])
        .take(100)
        .orderBy('contract.id', 'ASC')
        .getMany();
    } catch (e) {
      this.logger.error(e);
    }

    if (!contracts?.length) {
      return;
    }

    const contractIds: number[] = [];
    const tokenIds: number[] = [];
    const tokenAddresses: string[] = [];

    for (const contract of contracts) {
      contractIds.push(contract.id);

      for (const token of contract.tokens) {
        tokenIds.push(token.id);
        tokenAddresses.push(token.address);
      }
    }

    this.contractIds = contractIds;
    this.tokenAddresses = tokenAddresses;
    this.tokenIds = tokenIds;
  }

  async collectPriceData() {
    this.logger.log('Called method --> getTokenPrices');

    const uniqueAddresses = [...new Set(this.tokenAddresses)];
    const length = uniqueAddresses.length;

    for (let i = 0; i < length; i += TokensBatch) {
      await this.performGetTokenPrice(
        uniqueAddresses.slice(i, i + TokensBatch),
      );

      if (length > i + TokensBatch) {
        await delay(3000);
      }
    }
  }

  async updateTokenBalanceUSD() {
    this.logger.log('Called method --> updateTokenPriceAndBalanceUSD');

    for (const { address, price } of this.tokenPrices) {
      await this.tokenRepository
        .createQueryBuilder('token')
        .update(Token)
        .set({
          balanceUSD: () => `"balance" * ${price}`,
        })
        .where('token.id IN (:...ids)', { ids: this.tokenIds })
        .andWhere('address = :address', { address })
        .execute();

      await delay(1000);
    }

    const unknownTokenIds = this.tokenIds.filter((id, index) => {
      return !this.tokenPrices.find(
        ({ address }) => address === this.tokenAddresses[index],
      );
    });

    if (!unknownTokenIds.length) {
      return;
    }

    await this.tokenRepository
      .createQueryBuilder('token')
      .update(Token)
      .set({
        balanceUSD: 0,
      })
      .where('token.id IN (:...ids)', { ids: unknownTokenIds })
      .execute();
  }

  async updateContractTokenBalanceUSD(): Promise<void> {
    this.logger.log('Called method --> updateContractTokenBalanceUSD');

    await this.contractRepository
      .createQueryBuilder('contract')
      .update(Contract)
      .set({
        tokenBalanceUSD: () => `(
      COALESCE((
        SELECT SUM("balanceUSD") FROM "token" WHERE "token"."contractId" = "contract"."id"
      ), 0)
    )`,
      })
      .where('id IN (:...ids)', { ids: this.contractIds })
      .execute();
  }

  async performGetTokenPrice(addressesToSend: string[]) {
    let tokenPrices: ITokenPrice[] | null = await this.getTokenPrices(
      addressesToSend,
    );

    tokenPrices = await this.checkTokenPricesNeedRetry(
      tokenPrices,
      addressesToSend,
      0,
    );

    if (!tokenPrices) {
      this.tokenPrices = null;
    }

    this.tokenPrices.push(
      ...tokenPrices.map(({ address, price }) => ({
        address,
        price,
      })),
    );
  }

  async checkTokenPricesNeedRetry(
    tokenPrices: ITokenPrice[] | null,
    addressesToSend: string[],
    counter,
  ) {
    if (counter > 10) {
      return tokenPrices;
    }

    if (tokenPrices) {
      return tokenPrices;
    }

    await delay(3000);

    this.logger.error('Retrying to get token prices' + counter + 1);

    tokenPrices = await this.getTokenPrices(addressesToSend);

    return await this.checkTokenPricesNeedRetry(
      tokenPrices,
      addressesToSend,
      counter + 1,
    );
  }

  async getTokenPrices(addressesToSend: string[]) {
    const networkName = getNetworkName();
    const addressesQuery = addressesToSend
      .map((address) => `addresses=${networkName}:` + address)
      .join('&');

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`tokens?${addressesQuery}`, {
          params: {
            limit: TokensBatch,
          },
        }),
      );

      return data.tokens;
    } catch (e) {
      this.logger.error('Failed to get token prices ' + e.message);
    }
  }

  // async processTokenHoldingsToTokens() {
  //   if (process.env.SHOULD_TRANSFORM_TOKEN_HOLDINGS === 'false') {
  //     return;
  //   }
  //
  //   this.logger.log('Called method --> processTokenHoldingsToTokens');
  //
  //   const count = await this.contractRepository
  //     .createQueryBuilder('contract')
  //     .select('COUNT(contract.id)')
  //     .where('contract.tokenHoldings is not null')
  //     .getCount();
  //
  //   for (let i = 0; i < count; i += 100) {
  //     this.logger.log(`Processing ${i} of ${count}`);
  //     await this.transformTokenHoldingsToTokens(i);
  //     await delay(500);
  //   }
  //
  //   this.logger.log('Finished processing token holdings');
  // }

  // async transformTokenHoldingsToTokens(skip: number) {
  //   this.logger.log('Called method --> transformTokenHoldingsToTokens');
  //
  //   const tokens = [];
  //
  //   const contracts = await this.contractRepository
  //     .createQueryBuilder('contract')
  //     .select('contract.id')
  //     .addSelect('contract.tokenHoldings')
  //     .where('contract.tokenHoldings is not null')
  //     .skip(skip)
  //     .take(100)
  //     .getMany();
  //
  //   for (let i = 0; i < contracts.length; i++) {
  //     const contract = contracts[i];
  //
  //     for (const { address, balance, name } of contract.tokenHoldings) {
  //       tokens.push(
  //         new Token({
  //           address,
  //           balance: truncateDecimal(balance),
  //           name,
  //           contract,
  //         }),
  //       );
  //     }
  //   }
  //
  //   await this.insert(tokens);
  // }

  async insert(tokens: Token[]) {
    await this.tokenRepository
      .createQueryBuilder('token')
      .insert()
      .into(Token)
      .values(tokens)
      .execute();
  }
}
