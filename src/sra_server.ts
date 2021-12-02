import * as bodyParser from 'body-parser';
import * as express from 'express';

import { APIOrder, OrderbookResponse } from '@0x/connect';
import {
    ContractWrappers,
    DecodedLogEvent,
    ExchangeCancelEventArgs,
    ExchangeEvents,
    ExchangeFillEventArgs,
    OrderStatus,
} from '@0x/contract-wrappers';
import { NULL_ADDRESS, ZERO } from './constants';

import { BigNumber } from 'bignumber.js';
import { NETWORK_CONFIGS } from './configs';
import { SignedOrder } from '@0x/order-utils';
import { providerEngine } from './provider_engine';

var cors = require('cors')
const HTTP_OK_STATUS = 200;
const HTTP_BAD_REQUEST_STATUS = 400;
const HTTP_PORT = 3001;

// Global state
const orders: SignedOrder[] = [];
const ordersByHash: { [hash: string]: SignedOrder } = {};

// We subscribe to the Exchange Events to remove any filled or cancelled orders
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
// const contractWrappers = new ContractWrappers(providerEngine, { chainId: NETWORK_CONFIGS.chainId });
contractWrappers.exchange.subscribe(
    ExchangeEvents.Fill,
    {},
    (err: null | Error, decodedLogEvent?: DecodedLogEvent<ExchangeFillEventArgs>) => {
        if (err) {
            console.log('error:', err);
        } else if (decodedLogEvent) {
            const fillLog = decodedLogEvent.log;
            const orderHash = fillLog.args.orderHash;
            console.log(`Order filled ${fillLog.args.orderHash}`);
            removeOrder(orderHash);
        }
    },
);
// Listen for Cancel Exchange Events and remove any orders
contractWrappers.exchange.subscribe(
    ExchangeEvents.Cancel,
    {},
    (err: null | Error, decodedLogEvent?: DecodedLogEvent<ExchangeCancelEventArgs>) => {
        if (err) {
            console.log('error:', err);
        } else if (decodedLogEvent) {
            const fillLog = decodedLogEvent.log;
            const orderHash = fillLog.args.orderHash;
            console.log(`Order cancelled ${fillLog.args.orderHash}`);
            removeOrder(orderHash);
        }
    },
);

// HTTP Server
const app = express();
app.use(bodyParser.json());
app.use(cors());
/**
 * GET Orderbook endpoint retrieves the orderbook for a given asset pair.
 * http://sra-spec.s3-website-us-east-1.amazonaws.com/#operation/getOrderbook
 */
app.get('/v3/orderbook', (req, res) => {
    console.log('HTTP: GET orderbook');
    const baseAssetData = req.query.baseAssetData != undefined ? req.query.baseAssetData.toString() : "";
    const quoteAssetData = req.query.quoteAssetData != undefined ? req.query.quoteAssetData.toString() : "";
    const chainIdRaw = req.query.chainId != undefined? req.query.chainId.toString() : "";
    // tslint:disable-next-line:custom-no-magic-numbers
    const chainId = parseInt(chainIdRaw, 10);
    if (chainId !== NETWORK_CONFIGS.chainId) {
        console.log(`Incorrect Chain ID: ${chainId}`);
        res.status(HTTP_BAD_REQUEST_STATUS).send({});
    } else {
        const orderbookResponse = renderOrderbookResponse(baseAssetData, quoteAssetData);
        res.status(HTTP_OK_STATUS).send(orderbookResponse);
    }
});
/**
 * POST Order config endpoint retrives the values for order fields that the relayer requires.
 * http://sra-spec.s3-website-us-east-1.amazonaws.com/#operation/getOrderConfig
 */
app.post('/v3/order_config', (req, res) => {
    console.log('HTTP: POST order config');
    const chainIdRaw = req.query.chainId != undefined ? req.query.chainId.toString() : "";
    // tslint:disable-next-line:custom-no-magic-numbers
    const chainId = parseInt(chainIdRaw, 10);
    if (chainId !== NETWORK_CONFIGS.chainId) {
        console.log(`Incorrect Chain ID: ${chainId}`);
        res.status(HTTP_BAD_REQUEST_STATUS).send({});
    } else {
        const orderConfigResponse = {
            senderAddress: NULL_ADDRESS,
            feeRecipientAddress: NULL_ADDRESS,
            makerFee: ZERO,
            takerFee: '1000',
        };
        res.status(HTTP_OK_STATUS).send(orderConfigResponse);
    }
});
/**
 * POST Order endpoint submits an order to the Relayer.
 * http://sra-spec.s3-website-us-east-1.amazonaws.com/#operation/postOrder
 */
app.post('/v3/order', (req, res) => {
    console.log('HTTP: POST order');
    const chainIdRaw = req.query.chainId != undefined ? req.query.chainId.toString() : "";
    // tslint:disable-next-line:custom-no-magic-numbers
    const chainId = parseInt(chainIdRaw, 10);
    if (chainId !== NETWORK_CONFIGS.chainId) {
        console.log(`Incorrect Chain ID: ${chainId}`);
        res.status(HTTP_BAD_REQUEST_STATUS).send({});
    } else {
        const signedOrder = parseHTTPOrder(req.body);
        contractWrappers.devUtils
            .getOrderRelevantState(signedOrder, signedOrder.signature)
            .callAsync()
            .then(orderRelevantState => {
                const [{ orderStatus, orderHash }, remainingFillableAmount, isValidSignature] = orderRelevantState;
                if (
                    orderStatus === OrderStatus.Fillable &&
                    remainingFillableAmount.isGreaterThan(0) &&
                    isValidSignature
                ) {
                    // Order is fillable
                    ordersByHash[orderHash] = signedOrder;
                    orders.push(signedOrder);
                    res.status(HTTP_OK_STATUS).send({});
                } else {
                    res.status(HTTP_BAD_REQUEST_STATUS).send();
                }
            });
    }
});
app.listen(HTTP_PORT, () => console.log(`Standard relayer API (HTTP) listening on port ${HTTP_PORT}!`));
function getCurrentUnixTimestampSec(): BigNumber {
    const milisecondsInSecond = 1000;
    return new BigNumber(Date.now() / milisecondsInSecond).integerValue(BigNumber.ROUND_FLOOR);
}
function renderOrderbookResponse(baseAssetData: string, quoteAssetData: string): OrderbookResponse {
    const bidOrders = orders.filter(order => {
        return (
            order.takerAssetData === baseAssetData &&
            order.makerAssetData === quoteAssetData &&
            order.expirationTimeSeconds.isGreaterThan(getCurrentUnixTimestampSec())
        );
    });
    const askOrders = orders.filter(order => {
        return (
            order.takerAssetData === quoteAssetData &&
            order.makerAssetData === baseAssetData &&
            order.expirationTimeSeconds.isGreaterThan(getCurrentUnixTimestampSec())
        );
    });
    const bidApiOrders: APIOrder[] = bidOrders.map(order => {
        return { metaData: {}, order };
    });
    const askApiOrders: APIOrder[] = askOrders.map(order => {
        return { metaData: {}, order };
    });
    return {
        bids: {
            records: bidApiOrders,
            page: 1,
            perPage: 100,
            total: bidOrders.length,
        },
        asks: {
            records: askApiOrders,
            page: 1,
            perPage: 100,
            total: askOrders.length,
        },
    };
}

// As the orders come in as JSON they need to be turned into the correct types such as BigNumber
function parseHTTPOrder(signedOrder: any): SignedOrder {
    signedOrder.salt = new BigNumber(signedOrder.salt);
    signedOrder.makerAssetAmount = new BigNumber(signedOrder.makerAssetAmount);
    signedOrder.takerAssetAmount = new BigNumber(signedOrder.takerAssetAmount);
    signedOrder.makerFee = new BigNumber(signedOrder.makerFee);
    signedOrder.takerFee = new BigNumber(signedOrder.takerFee);
    signedOrder.expirationTimeSeconds = new BigNumber(signedOrder.expirationTimeSeconds);
    return signedOrder;
}

function removeOrder(orderHash: string): void {
    const order = ordersByHash[orderHash];
    const orderIndex = orders.indexOf(order);
    if (orderIndex > -1) {
        orders.splice(orderIndex, 1);
    }
}
