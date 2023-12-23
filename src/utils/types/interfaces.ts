import { TransactionResponse } from 'alchemy-sdk';

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

// export interface IContract extends IBaseContract {
//   name: string;
//   sourceCode: string;
//   isProxy?: boolean;
//   isUnprocessed?: boolean;
// }
