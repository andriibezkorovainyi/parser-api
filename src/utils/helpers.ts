import { IGetParseToBlockResult } from './types/interfaces';
import { Delay } from '../settings/parser.settings';
import { ethers } from 'ethers';

export const isValidResult = ({ incrementPointerBy }: IGetParseToBlockResult) =>
  !isNaN(incrementPointerBy);

export const delay = (delay = Delay) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};

export function parseBalance(balance: string, decimals: string): number {
  const units = ethers.formatUnits(balance, Number(decimals));
  const unitsDecimal = parseFloat(units);

  if (unitsDecimal === 0) {
    return 0;
  }

  return truncateDecimal(unitsDecimal);
}

export function truncateDecimal(
  value: number | string,
  precision = 20,
  scale = 8,
) {
  const decimalString = Number(value).toLocaleString('fullwide', {
    useGrouping: false,
    maximumFractionDigits: scale,
  });

  const [integerPart, fractionalPart] = decimalString.toString().split('.');

  const truncatedIntegerPart =
    integerPart.length > 12 ? integerPart.slice(0, 12) : integerPart;

  const allowedFractionalLength = Math.min(
    scale,
    precision - truncatedIntegerPart.length,
  );
  let truncatedFractionalPart = fractionalPart
    ? fractionalPart.slice(0, allowedFractionalLength)
    : '';

  // Удаляем ненужные нули в конце дробной части
  truncatedFractionalPart = truncatedFractionalPart.replace(/0+$/, '');

  // Собираем число обратно и удаляем ненужные нули после десятичной точки
  const truncatedValue = parseFloat(
    truncatedIntegerPart +
      (truncatedFractionalPart ? `.${truncatedFractionalPart}` : ''),
  );

  return truncatedValue;
}
