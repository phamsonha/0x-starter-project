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
                erc20Proxy: '0x1dc4c1cefef38a777b15aa20260a54e584b16c48',
                erc721Proxy: '0x1d7022f5b17d2f8b695918fb48fa1089c9f85401',
                erc1155Proxy: '0x6a4a62e5a7ed13c361b176a5f62c2ee620ac0df8',
                zrxToken: '0x871dd7c2b4b25e1aa18728e9d5f2af4c4e431f5c',
                etherToken: '0x0b1ba0af832d7c05fd64161e0db78e85978e8082',
                exchange: '0x48bacb9266a570d521063ef5dd96e61686dbe788',
                assetProxyOwner: '0x0000000000000000000000000000000000000000',
                erc20BridgeProxy: '0x371b13d97f4bf77d724e78c16b7dc74099f40e84',
                zeroExGovernor: '0x0000000000000000000000000000000000000000',
                forwarder: '0xa4b3e1659c473623287b2cc13b194705cd792525',
                coordinatorRegistry: '0xaa86dda78e9434aca114b6676fc742a18d15a1cc',
                coordinator: '0x4d3d5c850dd5bd9d6f4adda3dd039a3c8054ca29',
                multiAssetProxy: '0xcfc18cec799fbd1793b5c43e773c98d4d61cc2db',
                staticCallProxy: '0x6dfff22588be9b3ef8cf0ad6dc9b84796f9fb45f',
                devUtils: '0xb23672f74749bf7916ba6827c64111a4d6de7f11',
                exchangeV2: '0x48bacb9266a570d521063ef5dd96e61686dbe788',
                zrxVault: '0xf23276778860e420acfc18ebeebf7e829b06965c',
                staking: '0x8a063452f7df2614db1bca3a85ef35da40cf0835',
                stakingProxy: '0x59adefa01843c627ba5d6aa350292b4b7ccae67a',
                erc20BridgeSampler: '0x0000000000000000000000000000000000000000',
                chaiBridge: '0x0000000000000000000000000000000000000000',
                dydxBridge: '0x0000000000000000000000000000000000000000',
                godsUnchainedValidator: '0x0000000000000000000000000000000000000000',
                broker: '0x0000000000000000000000000000000000000000',
                chainlinkStopLimit: '0x0000000000000000000000000000000000000000',
                maximumGasPrice: '0x0000000000000000000000000000000000000000',
                dexForwarderBridge: '0x0000000000000000000000000000000000000000',
                exchangeProxyGovernor: '0x0000000000000000000000000000000000000000',
                exchangeProxy: '0x5315e44798395d4a952530d131249fe00f554565',
                exchangeProxyTransformerDeployer: '0x5409ed021d9299bf6814279a6a1411a7e866a631',
                exchangeProxyFlashWallet: '0xb9682a8e7920b431f1d412b8510f0077410c8faa',
                exchangeProxyLiquidityProviderSandbox: '0x0000000000000000000000000000000000000000',
                transformers: {
                  wethTransformer: '0xc6b0d3c45a6b5092808196cb00df5c357d55e1d5',
                  payTakerTransformer: '0x7209185959d7227fb77274e1e88151d7c4c368d3',
                  fillQuoteTransformer: '0x99356167edba8fbdc36959e3f5d0c43d1ba9c6db',
                  affiliateFeeTransformer: '0x3f16ca81691dab9184cb4606c361d73c4fd2510a',
                  positiveSlippageFeeTransformer: '0x45b3a72221e571017c0f0ec42189e11d149d0ace'
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
    const takerWETHDepositTxHash = await contractWrappers.weth9.deposit().sendTransactionAsync({
        value: takerAssetAmount,
        from: taker,
    });
    await printUtils.awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    PrintUtils.printData('Setup', [
        ['Maker ZRX Approval', makerZRXApprovalTxHash],
        ['Taker WETH Approval', takerWETHApprovalTxHash],
        ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

    // Initialize the Standard Relayer API client
    const httpClient = new HttpClient('http://localhost:3000/v3');
    const httpUtils = new HttpUtils("http://localhost:3000/v3", console.log);

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
