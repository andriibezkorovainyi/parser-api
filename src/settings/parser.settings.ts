import { AlchemySettings, Network } from 'alchemy-sdk';
import { NetworkType } from '../utils/types/enums';
import * as process from 'process';

export const network = NetworkType.ETH;

export const EtherscanReqPerSec = 5;

export const AlchemyReqPerSec = 10;

export const BlocksButch = 100;

export const ContractsButch = 100;

export const GenesisBlock = 0;

export const Delay = 3000;

export const InstanceId = process.env.INSTANCE_ID;

export const alchemyNetworkMap = new Map<NetworkType, Network>([
  [NetworkType.ETH, Network.ETH_MAINNET],
  [NetworkType.MATIC, Network.MATIC_MAINNET],
]);

export const alchemyRpcUrls = {
  [NetworkType.MATIC]:
    'https://polygon-mainnet.g.alchemy.com/v2/qvQNC3CnlMPud9U3o-wqhSK6QIkQYfCZ',
  [NetworkType.ETH]:
    'https://eth-mainnet.g.alchemy.com/v2/qvQNC3CnlMPud9U3o-wqhSK6QIkQYfCZ',
};
export const alchemyConfig = {
  apiKey: 'qvQNC3CnlMPud9U3o-wqhSK6QIkQYfCZ',
  network: alchemyNetworkMap.get(network),
} as AlchemySettings;

export const ethescanApiKeys = {
  [NetworkType.ETH]: 'SWRBEHMQ7XESVGITHJB8GPHRV3SP174A1R',
};

export const EtherscanApiKey = ethescanApiKeys[network];

export const quickNodeRpcUrls = {
  [NetworkType.MATIC]:
    'https://skilled-blissful-sound.matic.quiknode.pro/fbe4054257e029a987244b7ddc7910d72d36d994/',
  [NetworkType.ETH]:
    'https://frequent-wandering-tree.quiknode.pro/7fe156e00faf37497f60c9b16f4a0466d64fc9d6/',
};

export const quickNConfig = {
  endpointUrl: quickNodeRpcUrls.ETH,
};

export const axiosConfig = {};
