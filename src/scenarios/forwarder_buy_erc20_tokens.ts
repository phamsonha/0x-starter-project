import { ContractWrappers, ERC20TokenContract } from '@0x/contract-wrappers';
import { generatePseudoRandomSalt, Order, signatureUtils } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';

import { NETWORK_CONFIGS, TX_DEFAULTS } from '../configs';
import { DECIMALS, NULL_ADDRESS, NULL_BYTES, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import { PrintUtils } from '../print_utils';
import { providerEngine } from '../provider_engine';
import { calculateProtocolFee, getRandomFutureDateInSeconds, runMigrationsOnceIfRequiredAsync } from '../utils';

/**
 * In this scenario, the maker creates and signs an order for selling ZRX for WETH.
 * The taker uses the forwarding contract to buy these tokens. When using
 * the forwarding contract the taker does not require any additional setup.
 */
export async function scenarioAsync(): Promise<void> {
    PrintUtils.printScenario('Forwarder Buy Tokens');
    let contractAddress = undefined
    // contractAddress = await runMigrationsOnceIfRequiredAsync();
    // Initialize the ContractWrappers, this provides helper functions around calling
    // 0x contracts as well as ERC20/ERC721 token contracts on the blockchain
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
    // Initialize the Web3Wrapper, this provides helper functions around fetching
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, taker] = await web3Wrapper.getAvailableAddressesAsync();
    const zrxTokenAddress = contractWrappers.contractAddresses.zrxToken;
    const etherTokenAddress = contractWrappers.contractAddresses.etherToken;
    const printUtils = new PrintUtils(
        web3Wrapper,
        contractWrappers,
        { maker, taker },
        { WETH: etherTokenAddress, ZRX: zrxTokenAddress },
    );
    printUtils.printAccounts();

    // the amount the maker is selling of maker asset
    const makerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(5), DECIMALS);
    // the amount the maker wants of taker asset
    const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(0.1), DECIMALS);
    // 0x v2 uses hex encoded asset data strings to encode all the information needed to identify an asset
    const makerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(zrxTokenAddress).callAsync();
    const takerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(etherTokenAddress).callAsync();
    let txHash;
    let txReceipt;

    const zrxToken = new ERC20TokenContract(zrxTokenAddress, providerEngine);
    // Allow the 0x ERC20 Proxy to move ZRX on behalf of makerAccount
    const makerZRXApprovalTxHash = await zrxToken
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash);
    // With the Forwarding contract, the taker requires no set up
    PrintUtils.printData('Setup', [['Maker ZRX Approval', makerZRXApprovalTxHash]]);

    // Set up the Order and fill it
    const randomExpiration = getRandomFutureDateInSeconds();
    const exchangeAddress = contractWrappers.contractAddresses.exchange;

    // Create the order
    const order: Order = {
        chainId: NETWORK_CONFIGS.chainId,
        exchangeAddress,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: randomExpiration,
        salt: generatePseudoRandomSalt(),
        makerAssetAmount,
        takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFeeAssetData: NULL_BYTES,
        takerFeeAssetData: NULL_BYTES,
        makerFee: ZERO,
        takerFee: ZERO,
    };

    printUtils.printOrder(order);

    // Print out the Balances and Allowances
    await printUtils.fetchAndPrintContractAllowancesAsync();
    await printUtils.fetchAndPrintContractBalancesAsync();

    // Maker signs the order
    const signedOrder = await signatureUtils.ecSignOrderAsync(providerEngine, order, maker);
    const { orderHash } = await contractWrappers.exchange.getOrderInfo(signedOrder).callAsync();
    const affiliateFeeRecipient = [NULL_ADDRESS];
    const affiliateFee = [ZERO];

    // Use the Forwarder to market buy the ERC20 orders using Eth. When using the Forwarder
    // the taker does not need to set any allowances or deposit any ETH into WETH
    txHash = await contractWrappers.forwarder
        .marketBuyOrdersWithEth(
            [signedOrder],
            order.makerAssetAmount,
            [signedOrder.signature],
            affiliateFee,
            affiliateFeeRecipient,
        )
        .sendTransactionAsync({
            from: taker,
            ...TX_DEFAULTS,
            value: order.takerAssetAmount.plus(calculateProtocolFee([signedOrder])),
        });
    txReceipt = await printUtils.awaitTransactionMinedSpinnerAsync('marketBuyTokensWithEth', txHash);
    printUtils.printTransaction('marketBuyTokensWithEth', txReceipt, [['orderHash', orderHash]]);

    // Print the Balances
    await printUtils.fetchAndPrintContractBalancesAsync();

    // Stop the Provider Engine
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
