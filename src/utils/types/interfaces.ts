import { TransactionResponse } from 'alchemy-sdk';

export interface IGetParseToBlockResult {
  newPointer: number;
  pointer: number;
  isSynchronized: boolean;
  incrementPointerBy: number;
}

export interface ITransactionResponse extends TransactionResponse {
  creates: string | null;
}
export interface IGetBlockContractsResult {
  blockNumber: number;
  blockTimestamp?: number;
  contracts?: Partial<ITransactionResponse>[];
  isBlockNull?: boolean;
}
