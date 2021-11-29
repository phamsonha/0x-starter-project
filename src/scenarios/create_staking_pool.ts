import { ContractWrappers, ERC20TokenContract, StakingContract } from '@0x/contract-wrappers';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';

import { NETWORK_CONFIGS } from '../configs';
import { DECIMALS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS } from '../constants';
import { PrintUtils } from '../print_utils';
import { providerEngine } from '../provider_engine';
import { runMigrationsOnceIfRequiredAsync } from '../utils';

enum StakeStatus {
    Undelegated,
    Delegated,
}
const NIL_POOL_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * In this scenario, the maker creates a staking pool and joins it with
 * multiple addresses.
 */
export async function scenarioAsync(): Promise<void> {
    let contractAddress = undefined
    // let contractAddress = await runMigrationsOnceIfRequiredAsync();
    let txHash;
    PrintUtils.printScenario('Create Staking Pool');
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, otherMaker] = await web3Wrapper.getAvailableAddressesAsync();
    let contractConfig = {
        contractAddresses: (contractAddress != undefined ? contractAddress :
            {
                erc20Proxy: '0xa99abcbf17651aa4942118016627be6496f9aa32',
                erc721Proxy: '0xb2652d73739a013ca8825634838b5de5daeb0c90',
                erc1155Proxy: '0x5b56273af034e7f48e6df6cc2828fcce7a7ce887',
                zrxToken: '0xc1da575b5914833602d194d6d013c15270a2c84f',
                etherToken: '0xd3eca02c9fd5d1bc66f7477193bf7dea33bda48e',
                exchange: '0x92fea08efc9f78a2caa0ecf232e862c5765c6da8',
                assetProxyOwner: '0x0000000000000000000000000000000000000000',
                erc20BridgeProxy: '0xa1e328732f9ababdb08605e5cac94912553fcccc',
                zeroExGovernor: '0x0000000000000000000000000000000000000000',
                forwarder: '0x7a95b306c7846f5f752ad2cd1466b706bf3849c7',
                coordinatorRegistry: '0x43c517ddb700c7baf20f533df37cac70143f0971',
                coordinator: '0xddbe68beae54dd94465c6bba2477ee9500ce1974',
                multiAssetProxy: '0x5593d1c9bce28e2f1e2bf87fc64f8f17f48bd7a8',
                staticCallProxy: '0x8b8894867abaa7ced861fcaee1535603cac162fa',
                devUtils: '0x59b75b5531d65e684609e06411fc793d50034e16',
                exchangeV2: '0x48bacb9266a570d521063ef5dd96e61686dbe788',
                zrxVault: '0xdb363ce7c25e368005be1765ab0a3c33c34dbc7d',
                staking: '0x280cf27fe4e26121f377c174469bd270c19fa3cb',
                stakingProxy: '0xe3d85799ea9dc457ce52cac86ef9aee4d093ee13',
                erc20BridgeSampler: '0x0000000000000000000000000000000000000000',
                chaiBridge: '0x0000000000000000000000000000000000000000',
                dydxBridge: '0x0000000000000000000000000000000000000000',
                godsUnchainedValidator: '0x0000000000000000000000000000000000000000',
                broker: '0x0000000000000000000000000000000000000000',
                chainlinkStopLimit: '0x0000000000000000000000000000000000000000',
                maximumGasPrice: '0x0000000000000000000000000000000000000000',
                dexForwarderBridge: '0x0000000000000000000000000000000000000000',
                exchangeProxyGovernor: '0x0000000000000000000000000000000000000000',
                exchangeProxy: '0xd1793a457656151a1f0f4df41319122f54c4073f',
                exchangeProxyTransformerDeployer: '0x5409ed021d9299bf6814279a6a1411a7e866a631',
                exchangeProxyFlashWallet: '0xa70624240c52dae00d45d18a5093523067d06e9d',
                exchangeProxyLiquidityProviderSandbox: '0x0000000000000000000000000000000000000000',
                transformers: {
                  wethTransformer: '0x44ab9ee86ef2c1990946039fabfe619fd0b81f36',
                  payTakerTransformer: '0x2d1702bc51508b0163e83ec25cd9b1723dca3fef',
                  fillQuoteTransformer: '0x538281ccf8ad9266e6e3f6c6077e122b1f56dbd6',
                  affiliateFeeTransformer: '0x55cc97883d3283ee7abe2249e9a60c86cd292acf',
                  positiveSlippageFeeTransformer: '0x6bbc3a1f58f693450227789adf08b708367fb6ea'
                }
              }),
        networkId: NETWORK_CONFIGS.networkId,
        chainId: NETWORK_CONFIGS.chainId
    };

    const contractWrappers = new ContractWrappers(providerEngine,  contractConfig);
    console.log (contractWrappers.contractAddresses)
    const zrxTokenAddress = contractWrappers.contractAddresses.zrxToken;
    const printUtils = new PrintUtils(web3Wrapper, contractWrappers, { maker }, { ZRX: zrxTokenAddress });

    // Staking Proxy is a delegate contract. We initialize a Staking Contract (ABI) pointing to the delegate proxy
    // at stakingProxyContractAddress
    const stakingContract = new StakingContract(contractWrappers.contractAddresses.stakingProxy, providerEngine, {
        from: maker,
    });

    // A small share is kept for the operator, note 1,000,000 represents all rebates
    // going to the operator
    const operatorSharePpm = new BigNumber(900000); // 90 %
    const stakingPoolReceipt = await stakingContract
        .createStakingPool(operatorSharePpm, true)
        .awaitTransactionSuccessAsync({
            from: maker,
        });
    const createStakingPoolLog = stakingPoolReceipt.logs[0];
    const poolId = (createStakingPoolLog as any).args.poolId;
    await printUtils.awaitTransactionMinedSpinnerAsync(`Create Pool ${poolId}`, stakingPoolReceipt.transactionHash);

    // Approve the ZRX token for Staking using the ERC20Proxy
    const zrxTokenContract = new ERC20TokenContract(zrxTokenAddress, providerEngine, { from: maker });
    await zrxTokenContract
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync();

    // Stake 1000 ZRX
    const stakeAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(100), DECIMALS);
    // Transfer the ZRX to the Staking Contract
    txHash = await stakingContract.stake(stakeAmount).sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Stake ZRX', txHash);
    // Move the staked ZRX to delegate the Staking Pool
    txHash = await stakingContract
        .moveStake(
            { status: StakeStatus.Undelegated, poolId: NIL_POOL_ID },
            { status: StakeStatus.Delegated, poolId },
            stakeAmount,
        )
        .sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Move Stake To Pool', txHash);

    // Join the Pool with another maker address
    // This is useful if you wish to Market Make from different addresses
    txHash = await stakingContract.joinStakingPoolAsMaker(poolId).sendTransactionAsync({ from: otherMaker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Other Maker Joins Pool', txHash);

    // Decreases the Share of rebates for the Operator to 80%
    // This will give more rebate share to third party stakers and less to the operator
    txHash = await stakingContract.decreaseStakingPoolOperatorShare(poolId, new BigNumber(80000)).sendTransactionAsync({
        from: maker,
    });
    await printUtils.awaitTransactionMinedSpinnerAsync('Decrease Operator Share', txHash);

    // At the end of the Epoch, finalize the pool to withdraw operator rewards
    txHash = await stakingContract.finalizePool(poolId).sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync(`Finalize Pool ${poolId}`, txHash);

    providerEngine.stop();
}

void (async () => {
    try {
        if (!module.parent) {
            await scenarioAsync();
        }
    } catch (e) {
        console.log(e);
        providerEngine.stop();
        process.exit(1);
    }
})();
