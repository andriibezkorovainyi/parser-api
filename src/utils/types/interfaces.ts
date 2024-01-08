import { TransactionResponse } from 'alchemy-sdk';
import { QNGetWalletTokenBalanceResult } from '@quicknode/sdk';

export interface IGetParseToBlockResult {
  pointer: number;
  isSynchronized: boolean;
  incrementPointerBy: number;
}

export interface ITransactionResponse extends TransactionResponse {
  creates: string | null;
}
export interface IBlock {
  blockNumber: number;
  blockTimestamp?: number;
  contracts?: Partial<ITransactionResponse>[];
  isUnprocessed?: boolean;
}

export interface IContract {
  address: string;
  balance?: string;
  blockNumber: number;
  blockTimestamp?: number;
}

export interface IVerifiedCodeData {
  SourceCode: string;
  ABI: string;
  ContractName: string;
}

export interface IContractBalanceData extends QNGetWalletTokenBalanceResult {
  nativeTokenBalance?: string;
}

export interface ITokenBalance {
  name: string;
  address: string;
  balance: number;
  balanceUSD?: string;
}

export interface ITokenPrice {
  address: string;
  price: number;
}
