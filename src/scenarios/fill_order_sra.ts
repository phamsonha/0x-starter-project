import { HttpClient, OrderbookRequest } from '@0x/connect';
import { ContractWrappers, ERC20TokenContract, OrderStatus } from '@0x/contract-wrappers';
import { generatePseudoRandomSalt, Order, signatureUtils } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';

import { NETWORK_CONFIGS, TX_DEFAULTS } from '../configs';
import { DECIMALS, NULL_ADDRESS, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, NULL_BYTES, ZERO } from '../constants';

import HttpUtils from '../httpUtils';
import { PrintUtils } from '../print_utils';
import { providerEngine } from '../provider_engine';
import { calculateProtocolFee, getRandomFutureDateInSeconds, runMigrationsOnceIfRequiredAsync } from '../utils';

/**
 * In this scenario, the maker creates and signs an order for selling ZRX for WETH. This
 * order is then submitted to a Relayer via the Standard Relayer API. A Taker queries
 * this Standard Relayer API to discover orders.
 * The taker fills this order via the 0x Exchange contract.
 */
export async function scenarioAsync(): Promise<void> {
    PrintUtils.printScenario('Fill Order Standard Relayer API');
    let contractAddress = undefined
    // let contractAddress = await runMigrationsOnceIfRequiredAsync();
    // Initialize the ContractWrappers, this provides helper functions around calling
    // 0x contracts as well as ERC20/ERC721 token contracts on the blockchain
    let contractConfig = {
        contractAddresses: (contractAddress != undefined ? contractAddress :
            {
                erc20Proxy: '0x74687ec6c6b22476fdc567af44d79215fe8feffe',
                erc721Proxy: '0x86b5f7c9c9e73cce74809759706126f0f4592a33',
                erc1155Proxy: '0x24f72d131daa9c58410c34cf9ce16a90caab0423',
                zrxToken: '0xe0a45e74a5971456c837b96c649f98f122921fe8',
                etherToken: '0xaaa4370721620c2bba904c12b835c7cd96a7d774',
                exchange: '0x0ef2cec45b1780aa96f38868770b9ea84f752eff',
                assetProxyOwner: '0x0000000000000000000000000000000000000000',
                erc20BridgeProxy: '0x145c4c8e8e353b57a4768ba8d29613f096084243',
                zeroExGovernor: '0x0000000000000000000000000000000000000000',
                forwarder: '0x85ad200071447e00a6f91e03b74091b29ae04125',
                coordinatorRegistry: '0xd081ec30b1fba053d2cc1a619ef2d49f06d9b1db',
                coordinator: '0xa231a240e19b1f41c7d450837405c61adb757eee',
                multiAssetProxy: '0x3b4ba3bb21e4a2842a59e6363b2f1fc23c849e19',
                staticCallProxy: '0x212e06ce1cfc475a65babb39514d0612114de766',
                devUtils: '0x04a8e795d1a99700d44309d50fda8615cf8fd3ab',
                exchangeV2: '0x0000000000000000000000000000000000000000',
                zrxVault: '0x0bb2851cba74101d70333810c8a4ed4f6a6267ef',
                staking: '0xf0f2bb45274bd633e284aa81cf0da602cbbf3ceb',
                stakingProxy: '0x4a168fa4504fadad8aa0f25d652f471267294d78',
                erc20BridgeSampler: '0x0000000000000000000000000000000000000000',
                chaiBridge: '0x0000000000000000000000000000000000000000',
                dydxBridge: '0x0000000000000000000000000000000000000000',
                godsUnchainedValidator: '0x0000000000000000000000000000000000000000',
                broker: '0x0000000000000000000000000000000000000000',
                chainlinkStopLimit: '0x0000000000000000000000000000000000000000',
                maximumGasPrice: '0x0000000000000000000000000000000000000000',
                dexForwarderBridge: '0x0000000000000000000000000000000000000000',
                exchangeProxyGovernor: '0x0000000000000000000000000000000000000000',
                exchangeProxy: '0x39086633d62dd6369ed1e0a4083cb0d711e5ff7b',
                exchangeProxyTransformerDeployer: '0x753D9799e55852a9b86143E710EdE5510259fDb3',
                exchangeProxyFlashWallet: '0xce345d756a771a2746ed0ace61b272504856f375',
                exchangeProxyLiquidityProviderSandbox: '0x0000000000000000000000000000000000000000',
                transformers: {
                  wethTransformer: '0x04724a2d5b443647271bbf8268ba4869ccef95cc',
                  payTakerTransformer: '0xffd34f875d61ede0f20728a4bd2c26cc88fb35a8',
                  fillQuoteTransformer: '0x068d5ada3c94c5821219415043afb3cd589f8f65',
                  affiliateFeeTransformer: '0xc73ad96c730ece17c6e35a538ef3d8325394527d',
                  positiveSlippageFeeTransformer: '0xf2b002c5748392a1bd8a1c2c73ab2136026c4a22'
                }
              }
              ),
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

    const makerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(zrxTokenAddress).callAsync();
    const takerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(etherTokenAddress).callAsync();
    // the amount the maker is selling of maker asset
    const makerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(5), DECIMALS);
    // the amount the maker wants of taker asset
    const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(0.1), DECIMALS);

    let txHash;
    let txReceipt;

    const zrxToken = new ERC20TokenContract(zrxTokenAddress, providerEngine);
    // Allow the 0x ERC20 Proxy to move ZRX on behalf of makerAccount
    const makerZRXApprovalTxHash = await zrxToken
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Maker ZRX Approval', makerZRXApprovalTxHash);

    // Allow the 0x ERC20 Proxy to move ZRX on behalf of takerAccount
    const takerZRXApprovalTxHash = await zrxToken
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync({ from: taker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Taker ZRX Approval', takerZRXApprovalTxHash);

    // Allow the 0x ERC20 Proxy to move WETH on behalf of takerAccount
    const takerWETHApprovalTxHash = await contractWrappers.weth9
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync({ from: taker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash);

    // Convert ETH into WETH for taker by depositing ETH into the WETH contract
    // const takerWETHDepositTxHash = await contractWrappers.weth9.deposit().sendTransactionAsync({
    //     value: takerAssetAmount,
    //     from: taker,
    // });
    // await printUtils.awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    PrintUtils.printData('Setup', [
        ['Maker ZRX Approval', makerZRXApprovalTxHash],
        ['Taker WETH Approval', takerWETHApprovalTxHash],
        // ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

    // Initialize the Standard Relayer API client
    const httpClient = new HttpClient('http://localhost:3001/v3');
    const httpUtils = new HttpUtils("http://localhost:3001/v3", console.log);

    // Generate and expiration time and find the exchange smart contract address
    const randomExpiration = getRandomFutureDateInSeconds();
    const exchangeAddress = contractWrappers.contractAddresses.exchange;

    // Ask the relayer about the parameters they require for the order
    const orderConfigRequest = {
        exchangeAddress,
        verifyingContract: exchangeAddress,
        makerAddress: maker,
        takerAddress: NULL_ADDRESS,
        maker: maker,
        taker: NULL_ADDRESS,
        makerToken: zrxTokenAddress,
        takerToken: contractWrappers.weth9.address,
        expirationTimeSeconds: randomExpiration,
        expiry: randomExpiration,
        makerAssetAmount,
        takerAssetAmount,
        makerAmount: makerAssetAmount,
        takerAmount: takerAssetAmount,
        makerAssetData,
        takerAssetData,
        makerFeeAssetData: takerAssetData,
        takerFeeAssetData: takerAssetData,
        makerFee: ZERO,
        takerFee: ZERO,
    };
    console.log (orderConfigRequest)
    // const orderConfig = await httpClient.getOrderConfigAsync(orderConfigRequest);
    const orderConfig = await httpUtils.post (
        "/order_config",
        {chainId: NETWORK_CONFIGS.chainId},
        orderConfigRequest
    )
    console.log ("orderConfig")
    console.log (orderConfig)

    // Create the order
    const order: Order = {
        salt: generatePseudoRandomSalt(),
        chainId: NETWORK_CONFIGS.chainId,
        ...orderConfigRequest,
        ...orderConfig,
    };

    // Generate the order hash and sign it
    const signedOrder = await signatureUtils.ecSignOrderAsync(providerEngine, order, maker);

    // Validate this order
    const [
        { orderStatus, orderHash },
        remainingFillableAmount,
        isValidSignature,
    ] = await contractWrappers.devUtils.getOrderRelevantState(signedOrder, signedOrder.signature).callAsync();
    if (orderStatus === OrderStatus.Fillable && remainingFillableAmount.isGreaterThan(0) && isValidSignature) {
        // Order is fillable
    }

    // Submit the order to the SRA Endpoint
    // await httpClient.submitOrderAsync(signedOrder);
    console.log ("submitOrderAsync done")
    const orderSubmit = await httpUtils.post (
        "/order",
        {chainId: NETWORK_CONFIGS.chainId},
        signedOrder
    )
    console.log (orderSubmit)

    // Taker queries the Orderbook from the Relayer
    const orderbookRequest: OrderbookRequest = { baseAssetData: makerAssetData, quoteAssetData: takerAssetData };
    // const response = await httpClient.getOrderbookAsync(orderbookRequest);
    const orderbook = await httpUtils.get (
        "/orderbook",
        {chainId: NETWORK_CONFIGS.chainId, ...orderbookRequest}
    )
    console.log (orderbook)
    if (orderbook.asks.total === 0) {
        throw new Error('No orders found on the SRA Endpoint');
    }
    const sraOrder = orderbook.asks.records[0].order;
    printUtils.printOrder(sraOrder);

    // If the SRA endpoint has a taker fee the taker will need to be funded
    const takerZRXBalance = await zrxToken.balanceOf(taker).callAsync();
    if (new BigNumber (order.takerFee).isGreaterThan(takerZRXBalance)) {
        // As an example we fund the taker from the maker
        const takerZRXFeeTxHash = await zrxToken.transfer(taker, order.takerFee).sendTransactionAsync({
            from: maker,
        });
        await printUtils.awaitTransactionMinedSpinnerAsync('Taker ZRX fund', takerZRXFeeTxHash);
    }

    // Validate the order is Fillable given the maker and taker balances
    // await contractWrappers.exchange.validateFillOrderThrowIfInvalidAsync(sraOrder, takerAssetAmount, taker);

    // Fill the Order via 0x Exchange contract
    txHash = await contractWrappers.exchange
        .fillOrder(sraOrder, takerAssetAmount, sraOrder.signature)
        .sendTransactionAsync({
            from: taker,
            ...TX_DEFAULTS,
            value: calculateProtocolFee([sraOrder]),
        });
    txReceipt = await printUtils.awaitTransactionMinedSpinnerAsync('fillOrder', txHash);
    printUtils.printTransaction('fillOrder', txReceipt, [['orderHash', orderHash]]);

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
