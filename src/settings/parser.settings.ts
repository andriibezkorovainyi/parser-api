import { AlchemySettings, Network } from 'alchemy-sdk';
import { NetworkType } from '../utils/types/enums';
import * as process from 'process';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('process.env.LOG_LEVEL', process.env.LOG_LEVEL);

export const network = NetworkType[process.env.NETWORK];

export const EtherscanReqPerSec = 5;

export const AlchemyReqPerSec = 10;

export const QuickNodeReqPerSec = 5;

export const BlocksBatch = 100;

export const ContractsBatch = 5;

export const GenesisBlock = 1_000_000;

export const Delay = 3000;

export const InstanceId = Number(process.env.INSTANCE_ID);

export const apiCredentials = {
  alchemyApiKey: process.env[`${network}_${InstanceId}_ALCHEMY_API_KEY`],
  etherscanApiKey: process.env[`${network}_${InstanceId}_ETHERSCAN_API_KEY`],
  quickNodeEndpointUrl:
    process.env[`${network}_${InstanceId}_QUICKNODE_ENDPOINT_URL`],
};

export const alchemyNetworkMap = new Map<NetworkType, Network>([
  [NetworkType.ETH, Network.ETH_MAINNET],
  [NetworkType.MATIC, Network.MATIC_MAINNET],
]);

export const alchemyConfig = {
  apiKey: apiCredentials.alchemyApiKey,
  network: alchemyNetworkMap.get(network),
} as AlchemySettings;

console.log('alchemyConfig', alchemyConfig);

export const quickNConfig = {
  endpointUrl: apiCredentials.quickNodeEndpointUrl,
  config: {
    addOns: {
      nftTokenV2: true,
    },
  },
};
