import { IGetParseToBlockResult } from './types/interfaces';
import { Delay } from '../settings/parser.settings';

export const isValidResult = ({ incrementPointerBy }: IGetParseToBlockResult) =>
  !isNaN(incrementPointerBy);

export const delay = () => {
  console.log(`Delay for ${Delay} ms`);
  return new Promise((resolve) => {
    setTimeout(resolve, Delay);
  });
};
