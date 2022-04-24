import { GANACHE_NETWORK_ID, KOVAN_NETWORK_ID, RINKEBY_NETWORK_ID, ROPSTEN_NETWORK_ID, BSCTESTNET_NETWORK_ID } from './constants';
import { NetworkSpecificConfigs } from './types';
const fs = require('fs');

export const TX_DEFAULTS = { gas: 7000000, gasPrice: 2000000000 };
export const MNEMONIC = fs.readFileSync(".secret").toString().trim();
export const BASE_DERIVATION_PATH = `44'/60'/0'/0`;
export const GANACHE_CONFIGS: NetworkSpecificConfigs = {
    rpcUrl: 'http://127.0.0.1:8545',
    networkId: GANACHE_NETWORK_ID,
    chainId: 1337,
};
export const KOVAN_CONFIGS: NetworkSpecificConfigs = {
    rpcUrl: 'https://kovan.infura.io/v3/919f8cd33cac4251837cd8fea72a6aa0',
    networkId: KOVAN_NETWORK_ID,
    chainId: KOVAN_NETWORK_ID,
};
export const ROPSTEN_CONFIGS: NetworkSpecificConfigs = {
    rpcUrl: 'https://ropsten.infura.io/v3/919f8cd33cac4251837cd8fea72a6aa0',
    networkId: ROPSTEN_NETWORK_ID,
    chainId: ROPSTEN_NETWORK_ID,
};
export const RINKEBY_CONFIGS: NetworkSpecificConfigs = {
    rpcUrl: 'https://rinkeby.infura.io/v3/919f8cd33cac4251837cd8fea72a6aa0',
    networkId: RINKEBY_NETWORK_ID,
    chainId: RINKEBY_NETWORK_ID,
};
export const BSCTESTNET_CONFIGS: NetworkSpecificConfigs = {
    rpcUrl: 'https://data-seed-prebsc-2-s3.binance.org:8545',
    networkId: BSCTESTNET_NETWORK_ID,
    chainId: BSCTESTNET_NETWORK_ID,
};
export const NETWORK_CONFIGS = GANACHE_CONFIGS; // or KOVAN_CONFIGS or ROPSTEN_CONFIGS or RINKEBY_CONFIGS
