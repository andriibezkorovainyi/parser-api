import { IGetParseToBlockResult } from './types/interfaces';

export const isValidResult = ({
  newPointer,
  incrementPointerBy,
}: IGetParseToBlockResult) => !isNaN(incrementPointerBy) && !isNaN(newPointer);
