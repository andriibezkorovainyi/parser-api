import { IGetParseToBlockResult } from './types/interfaces';
import { Delay } from '../settings/parser.settings';

export const isValidResult = ({ incrementPointerBy }: IGetParseToBlockResult) =>
  !isNaN(incrementPointerBy);

export const delay = () => new Promise((resolve) => setTimeout(resolve, Delay));
