"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.getLocalEip712Signature = exports.createCustomSmartWallet = exports.createCustomSmartWalletFactory = exports.createSmartWallet = exports.createSmartWalletFactory = exports.containsEvent = exports.getTestingEnvironment = exports.defaultEnvironment = exports.environments = exports.generateBytes32 = void 0;
var __1 = require("../");
var constants_1 = require("./constants");
var eth_sig_util_1 = require("eth-sig-util");
var ethereumjs_util_1 = require("ethereumjs-util");
var web3_utils_1 = require("web3-utils");
function generateBytes32(seed) {
    return '0x' + seed.toString().repeat(64).slice(0, 64);
}
exports.generateBytes32 = generateBytes32;
var defaultRelayHubConfiguration = {
    maxWorkerCount: 10,
    minimumStake: (1e18).toString(),
    minimumUnstakeDelay: 1000,
    minimumEntryDepositValue: (1e18).toString()
};
exports.environments = {
    istanbul: {
        chainId: 1,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    },
    constantinople: {
        chainId: 1,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    },
    rsk: {
        chainId: 33,
        relayHubConfiguration: defaultRelayHubConfiguration,
        mintxgascost: 21000
    }
};
exports.defaultEnvironment = exports.environments.rsk;
function getTestingEnvironment() {
    return __awaiter(this, void 0, void 0, function () {
        var networkId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, web3.eth.net.getId()];
                case 1:
                    networkId = _a.sent();
                    return [2 /*return*/, networkId === 33 ? exports.environments.rsk : exports.defaultEnvironment];
            }
        });
    });
}
exports.getTestingEnvironment = getTestingEnvironment;
/**
 * Get a Map from topics to their corresponding event's ABI
 */
function getEventsAbiByTopic(abi) {
    var eventsAbiByTopic = new Map();
    // @ts-ignore
    var logicEvents = abi.filter(function (elem) { return elem.type === 'event'; });
    // @ts-ignore
    logicEvents.forEach(function (abi) {
        eventsAbiByTopic.set(abi.signature, abi);
    });
    return eventsAbiByTopic;
}
/**
 * Decodes events which satisfies an ABI specification
 */
function containsEvent(abi, rawLogs, eventName) {
    var eventsAbiByTopic = getEventsAbiByTopic(abi);
    // @ts-ignore
    return rawLogs.some(function (log) {
        return eventsAbiByTopic.has(log.topics[0]) &&
            eventsAbiByTopic.get(log.topics[0]).name === eventName;
    });
}
exports.containsEvent = containsEvent;
function createSmartWalletFactory(template) {
    return __awaiter(this, void 0, void 0, function () {
        var SmartWalletFactory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    SmartWalletFactory = artifacts.require('SmartWalletFactory');
                    return [4 /*yield*/, SmartWalletFactory["new"](template.address)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.createSmartWalletFactory = createSmartWalletFactory;
function createSmartWallet(relayHub, ownerEOA, factory, privKey, chainId, tokenContract, tokenAmount, tokenGas, recoverer) {
    if (chainId === void 0) { chainId = -1; }
    if (tokenContract === void 0) { tokenContract = constants_1.constants.ZERO_ADDRESS; }
    if (tokenAmount === void 0) { tokenAmount = '0'; }
    if (tokenGas === void 0) { tokenGas = '0'; }
    if (recoverer === void 0) { recoverer = constants_1.constants.ZERO_ADDRESS; }
    return __awaiter(this, void 0, void 0, function () {
        var _a, rReq, createdataToSign, deploySignature, encoded, countParams, suffixData, txResult, swAddress, SmartWallet, sw;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(chainId < 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, getTestingEnvironment()];
                case 1:
                    _a = (_b.sent()).chainId;
                    return [3 /*break*/, 3];
                case 2:
                    _a = chainId;
                    _b.label = 3;
                case 3:
                    chainId = _a;
                    rReq = {
                        request: {
                            relayHub: relayHub,
                            from: ownerEOA,
                            to: constants_1.constants.ZERO_ADDRESS,
                            value: '0',
                            nonce: '0',
                            data: '0x',
                            tokenContract: tokenContract,
                            tokenAmount: tokenAmount,
                            tokenGas: tokenGas,
                            recoverer: recoverer,
                            index: '0'
                        },
                        relayData: {
                            gasPrice: '10',
                            relayWorker: constants_1.constants.ZERO_ADDRESS,
                            callForwarder: constants_1.constants.ZERO_ADDRESS,
                            callVerifier: constants_1.constants.ZERO_ADDRESS
                        }
                    };
                    createdataToSign = new __1.TypedDeployRequestData(chainId, factory.address, rReq);
                    deploySignature = getLocalEip712Signature(createdataToSign, privKey);
                    encoded = eth_sig_util_1.TypedDataUtils.encodeData(createdataToSign.primaryType, createdataToSign.message, createdataToSign.types);
                    countParams = __1.DeployRequestDataType.length;
                    suffixData = (0, ethereumjs_util_1.bufferToHex)(encoded.slice((1 + countParams) * 32));
                    return [4 /*yield*/, factory.relayedUserSmartWalletCreation(rReq.request, suffixData, deploySignature)];
                case 4:
                    txResult = _b.sent();
                    console.log('Cost of deploying SmartWallet: ', txResult.receipt.cumulativeGasUsed);
                    return [4 /*yield*/, factory.getSmartWalletAddress(ownerEOA, recoverer, '0')];
                case 5:
                    swAddress = _b.sent();
                    SmartWallet = artifacts.require('SmartWallet');
                    return [4 /*yield*/, SmartWallet.at(swAddress)];
                case 6:
                    sw = _b.sent();
                    return [2 /*return*/, sw];
            }
        });
    });
}
exports.createSmartWallet = createSmartWallet;
function createCustomSmartWalletFactory(template) {
    return __awaiter(this, void 0, void 0, function () {
        var CustomSmartWalletFactory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    CustomSmartWalletFactory = artifacts.require('CustomSmartWalletFactory');
                    return [4 /*yield*/, CustomSmartWalletFactory["new"](template.address)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.createCustomSmartWalletFactory = createCustomSmartWalletFactory;
function createCustomSmartWallet(relayHub, ownerEOA, factory, privKey, chainId, logicAddr, initParams, tokenContract, tokenAmount, tokenGas, recoverer) {
    if (chainId === void 0) { chainId = -1; }
    if (logicAddr === void 0) { logicAddr = constants_1.constants.ZERO_ADDRESS; }
    if (initParams === void 0) { initParams = '0x'; }
    if (tokenContract === void 0) { tokenContract = constants_1.constants.ZERO_ADDRESS; }
    if (tokenAmount === void 0) { tokenAmount = '0'; }
    if (tokenGas === void 0) { tokenGas = '0'; }
    if (recoverer === void 0) { recoverer = constants_1.constants.ZERO_ADDRESS; }
    return __awaiter(this, void 0, void 0, function () {
        var _a, rReq, createdataToSign, deploySignature, encoded, countParams, suffixData, txResult, swAddress, CustomSmartWallet, sw;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(chainId < 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, getTestingEnvironment()];
                case 1:
                    _a = (_b.sent()).chainId;
                    return [3 /*break*/, 3];
                case 2:
                    _a = chainId;
                    _b.label = 3;
                case 3:
                    chainId = _a;
                    rReq = {
                        request: {
                            relayHub: relayHub,
                            from: ownerEOA,
                            to: logicAddr,
                            value: '0',
                            nonce: '0',
                            data: initParams,
                            tokenContract: tokenContract,
                            tokenAmount: tokenAmount,
                            tokenGas: tokenGas,
                            recoverer: recoverer,
                            index: '0'
                        },
                        relayData: {
                            gasPrice: '10',
                            relayWorker: constants_1.constants.ZERO_ADDRESS,
                            callForwarder: constants_1.constants.ZERO_ADDRESS,
                            callVerifier: constants_1.constants.ZERO_ADDRESS
                        }
                    };
                    createdataToSign = new __1.TypedDeployRequestData(chainId, factory.address, rReq);
                    deploySignature = getLocalEip712Signature(createdataToSign, privKey);
                    encoded = eth_sig_util_1.TypedDataUtils.encodeData(createdataToSign.primaryType, createdataToSign.message, createdataToSign.types);
                    countParams = __1.DeployRequestDataType.length;
                    suffixData = (0, ethereumjs_util_1.bufferToHex)(encoded.slice((1 + countParams) * 32));
                    return [4 /*yield*/, factory.relayedUserSmartWalletCreation(rReq.request, suffixData, deploySignature, { from: relayHub })];
                case 4:
                    txResult = _b.sent();
                    console.log('Cost of deploying SmartWallet: ', txResult.receipt.cumulativeGasUsed);
                    return [4 /*yield*/, factory.getSmartWalletAddress(ownerEOA, recoverer, logicAddr, (0, web3_utils_1.soliditySha3Raw)({ t: 'bytes', v: initParams }), '0')];
                case 5:
                    swAddress = _b.sent();
                    CustomSmartWallet = artifacts.require('CustomSmartWallet');
                    return [4 /*yield*/, CustomSmartWallet.at(swAddress)];
                case 6:
                    sw = _b.sent();
                    return [2 /*return*/, sw];
            }
        });
    });
}
exports.createCustomSmartWallet = createCustomSmartWallet;
function getLocalEip712Signature(typedRequestData, privateKey) {
    // @ts-ignore
    return eth_sig_util_1["default"].signTypedData_v4(privateKey, { data: typedRequestData });
}
exports.getLocalEip712Signature = getLocalEip712Signature;
