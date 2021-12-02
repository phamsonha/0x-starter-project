import { runMigrationsOnceAsync, ContractAddresses } from '@0x/migrations';
import { SignedOrder } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';
// tslint:disable-next-line:no-implicit-dependencies
import * as ethers from 'ethers';

import { GANACHE_CONFIGS, NETWORK_CONFIGS, TX_DEFAULTS } from './configs';
import { ONE_SECOND_MS, TEN_MINUTES_MS } from './constants';
import { PrintUtils } from './print_utils';
import { providerEngine } from './provider_engine';

// HACK prevent ethers from printing 'Multiple definitions for'
ethers.errors.setLogLevel('error');

/**
 * Returns an amount of seconds that is greater than the amount of seconds since epoch.
 */
export const getRandomFutureDateInSeconds = (): BigNumber => {
    return new BigNumber(Date.now() + TEN_MINUTES_MS).div(ONE_SECOND_MS).integerValue(BigNumber.ROUND_CEIL);
};

export const runMigrationsOnceIfRequiredAsync = async (): Promise<ContractAddresses | undefined> => {
    if (NETWORK_CONFIGS === GANACHE_CONFIGS) {
        const web3Wrapper = new Web3Wrapper(providerEngine);

        const [owner] = await web3Wrapper.getAvailableAddressesAsync();
        const currentNonce = await web3Wrapper.getAccountNonceAsync(owner);
        console.log (`currentNonce: ${currentNonce}`)

        return await runMigrationsOnceAsync(providerEngine, { from: owner });
    }
};

export const calculateProtocolFee = (
    orders: SignedOrder[],
    gasPrice: BigNumber | number = TX_DEFAULTS.gasPrice,
): BigNumber => {
    return new BigNumber(200000).times(gasPrice).times(orders.length);
};
