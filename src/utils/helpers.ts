import { IGetParseToBlockResult } from './types/interfaces';

export const isValidResult = ({
  parseToBlock,
  parseCount,
}: IGetParseToBlockResult) => !isNaN(parseCount) && !isNaN(parseToBlock);
