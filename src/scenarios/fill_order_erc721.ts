import { ContractWrappers, ERC721TokenContract } from '@0x/contract-wrappers';
import { assetDataUtils, generatePseudoRandomSalt, Order, signatureUtils } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';

import { NETWORK_CONFIGS, TX_DEFAULTS } from '../configs';
import { DECIMALS, NULL_ADDRESS, NULL_BYTES, UNLIMITED_ALLOWANCE_IN_BASE_UNITS, ZERO } from '../constants';
import { dummyERC721TokenContracts } from '../contracts';
import { PrintUtils } from '../print_utils';
import { providerEngine } from '../provider_engine';
import { calculateProtocolFee, getRandomFutureDateInSeconds, runMigrationsOnceIfRequiredAsync } from '../utils';

/**
 * In this scenario, the maker creates and signs an order for selling an ERC721 token for WETH.
 * The taker fills it via the 0x Exchange contract.
 */
export async function scenarioAsync(): Promise<void> {
    PrintUtils.printScenario('Fill Order ERC721');
    let contractAddress = undefined
    // contractAddress = await runMigrationsOnceIfRequiredAsync();
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
    const etherTokenAddress = contractWrappers.contractAddresses.etherToken;
    const dummyERC721TokenContract = dummyERC721TokenContracts[0];
    if (!dummyERC721TokenContract) {
        console.log('No Dummy ERC721 Tokens deployed on this network');
        return;
    }
    // Initialize the Web3Wrapper, this provides helper functions around fetching
    // account information, balances, general contract logs
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const [maker, taker] = await web3Wrapper.getAvailableAddressesAsync();

    const printUtils = new PrintUtils(web3Wrapper, contractWrappers, { maker, taker }, { WETH: etherTokenAddress });
    printUtils.printAccounts();

    // the amount the maker is selling of maker asset (1 ERC721 Token)
    const makerAssetAmount = new BigNumber(1);
    // the amount the maker wants of taker asset
    const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(0.01), DECIMALS);
    // Generate a random token id
    const tokenId = generatePseudoRandomSalt();
    // 0x v2 uses hex encoded asset data strings to encode all the information needed to identify an asset
    const makerAssetData = assetDataUtils.encodeERC721AssetData(dummyERC721TokenContract.address, tokenId);
    const takerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(etherTokenAddress).callAsync();
    let txHash;

    // Mint a new ERC721 token for the maker
    const mintTxHash = await dummyERC721TokenContract.mint(maker, tokenId).sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Mint ERC721 Token', mintTxHash);

    // Allow the 0x ERC721 Proxy to move ERC721 tokens on behalf of maker
    const erc721Token = new ERC721TokenContract(dummyERC721TokenContract.address, providerEngine);
    const makerERC721ApprovalTxHash = await erc721Token
        .setApprovalForAll(contractWrappers.contractAddresses.erc721Proxy, true)
        .sendTransactionAsync({ from: maker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Maker ERC721 Approval', makerERC721ApprovalTxHash);

    // Allow the 0x ERC20 Proxy to move WETH on behalf of takerAccount
    const etherToken = contractWrappers.weth9;
    const takerWETHApprovalTxHash = await etherToken
        .approve(contractWrappers.contractAddresses.erc20Proxy, UNLIMITED_ALLOWANCE_IN_BASE_UNITS)
        .sendTransactionAsync({ from: taker });
    await printUtils.awaitTransactionMinedSpinnerAsync('Taker WETH Approval', takerWETHApprovalTxHash);

    // Convert ETH into WETH for taker by depositing ETH into the WETH contract
    const takerWETHDepositTxHash = await etherToken.deposit().sendTransactionAsync({
        from: taker,
        value: takerAssetAmount,
    });
    await printUtils.awaitTransactionMinedSpinnerAsync('Taker WETH Deposit', takerWETHDepositTxHash);

    PrintUtils.printData('Setup', [
        ['Mint ERC721', mintTxHash],
        ['Maker ERC721 Approval', makerERC721ApprovalTxHash],
        ['Taker WETH Approval', takerWETHApprovalTxHash],
        ['Taker WETH Deposit', takerWETHDepositTxHash],
    ]);

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
    await printUtils.fetchAndPrintERC721OwnerAsync(dummyERC721TokenContract.address, tokenId);

    // Generate the order hash and sign it
    const signedOrder = await signatureUtils.ecSignOrderAsync(providerEngine, order, maker);
    console.log (signedOrder)
    const { orderHash } = await contractWrappers.exchange.getOrderInfo(signedOrder).callAsync();
    // Fill the Order via 0x.js Exchange contract
    txHash = await contractWrappers.exchange
        .fillOrder(signedOrder, takerAssetAmount, signedOrder.signature)
        .sendTransactionAsync({ from: taker, ...TX_DEFAULTS, value: calculateProtocolFee([signedOrder]) });
    const txReceipt = await printUtils.awaitTransactionMinedSpinnerAsync('fillOrder', txHash);
    printUtils.printTransaction('fillOrder', txReceipt, [['orderHash', orderHash]]);

    // Print the Balances
    await printUtils.fetchAndPrintContractBalancesAsync();
    await printUtils.fetchAndPrintERC721OwnerAsync(dummyERC721TokenContract.address, tokenId);

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
