import sigUtil, {
    // @ts-ignore
    signTypedData_v4,
    EIP712TypedData,
    TypedDataUtils
} from 'eth-sig-util';
import { bufferToHex, privateToAddress } from 'ethereumjs-util';
import { soliditySha3Raw } from 'web3-utils';
import { PrefixedHexString } from 'ethereumjs-tx';
import ethWallet from 'ethereumjs-wallet';
import { HttpProvider } from 'web3-core';
import RelayHubConfiguration from '../types/RelayHubConfiguration';
import {
    SmartWalletFactoryInstance,
    IForwarderInstance,
    SmartWalletInstance,
    CustomSmartWalletFactoryInstance,
    CustomSmartWalletInstance,
    RelayHubInstance,
    TestTokenInstance
} from '../types/truffle-contracts';
import {
    DeployRequest,
    DeployRequestDataType,
    DeployRequestStruct,
    ForwardRequest,
    ForwardRequestType,
    RelayData,
    RelayRequest,
    TypedDeployRequestData,
    TypedRequestData
} from '../';
import { constants } from './constants';

const RelayHub = artifacts.require('RelayHub');

export function generateBytes32(seed: number): string {
    return '0x' + seed.toString().repeat(64).slice(0, 64);
}

export interface Environment {
    readonly chainId: number;
    readonly mintxgascost: number;
    readonly relayHubConfiguration: RelayHubConfiguration;
}

const defaultRelayHubConfiguration: RelayHubConfiguration = {
    maxWorkerCount: 10,
    minimumStake: (1e18).toString(),
    minimumUnstakeDelay: 1000,
    minimumEntryDepositValue: (1e18).toString()
};

export const environments: { [key: string]: Environment } = {
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

export const defaultEnvironment = environments.rsk;

export async function getTestingEnvironment(): Promise<Environment> {
    const networkId = await web3.eth.net.getId();
    return networkId === 33 ? environments.rsk : defaultEnvironment;
}

/**
 * Get a Map from topics to their corresponding event's ABI
 */
function getEventsAbiByTopic(abi: any): Map<string, any> {
    const eventsAbiByTopic = new Map<string, any>();
    // @ts-ignore
    const logicEvents = abi.filter((elem) => elem.type === 'event');
    // @ts-ignore
    logicEvents.forEach((abi) => {
        eventsAbiByTopic.set(abi.signature, abi);
    });
    return eventsAbiByTopic;
}

/**
 * Decodes events which satisfies an ABI specification
 */
export function containsEvent(
    abi: any,
    rawLogs: any,
    eventName: string
): boolean {
    const eventsAbiByTopic = getEventsAbiByTopic(abi);
    // @ts-ignore
    return rawLogs.some(
        (log) =>
            eventsAbiByTopic.has(log.topics[0]) &&
            eventsAbiByTopic.get(log.topics[0]).name === eventName
    );
}

export async function createSmartWalletFactory(
    template: IForwarderInstance
): Promise<SmartWalletFactoryInstance> {
    const SmartWalletFactory = artifacts.require('SmartWalletFactory');
    return await SmartWalletFactory.new(template.address);
}

export async function createSmartWallet(
    relayHub: string,
    ownerEOA: string,
    factory: SmartWalletFactoryInstance,
    privKey: Buffer,
    chainId = -1,
    tokenContract: string = constants.ZERO_ADDRESS,
    tokenAmount = '0',
    tokenGas = '0',
    recoverer: string = constants.ZERO_ADDRESS
): Promise<SmartWalletInstance> {
    chainId = chainId < 0 ? (await getTestingEnvironment()).chainId : chainId;

    const rReq: DeployRequest = {
        request: {
            relayHub: relayHub,
            from: ownerEOA,
            to: constants.ZERO_ADDRESS,
            value: '0',
            nonce: '0',
            data: '0x',
            tokenContract: tokenContract,
            tokenAmount: tokenAmount,
            tokenGas: tokenGas,
            recoverer: recoverer,
            validUntilTime: '0',
            index: '0'
        },
        relayData: {
            gasPrice: '10',
            feesReceiver: constants.ZERO_ADDRESS,
            callForwarder: constants.ZERO_ADDRESS,
            callVerifier: constants.ZERO_ADDRESS
        }
    };

    const createdataToSign = new TypedDeployRequestData(
        chainId,
        factory.address,
        rReq
    );

    const deploySignature = getLocalEip712Signature(createdataToSign, privKey);
    const encoded = TypedDataUtils.encodeData(
        createdataToSign.primaryType,
        createdataToSign.message,
        createdataToSign.types
    );
    const countParams = DeployRequestDataType.length;
    const suffixData = bufferToHex(encoded.slice((1 + countParams) * 32)); // keccak256 of suffixData
    const txResult = await factory.relayedUserSmartWalletCreation(
        rReq.request,
        suffixData,
        constants.ZERO_ADDRESS,
        deploySignature
    );

    console.log(
        'Cost of deploying SmartWallet: ',
        txResult.receipt.cumulativeGasUsed
    );
    const swAddress = await factory.getSmartWalletAddress(
        ownerEOA,
        recoverer,
        '0'
    );

    const SmartWallet = artifacts.require('SmartWallet');
    const sw: SmartWalletInstance = await SmartWallet.at(swAddress);

    return sw;
}

export async function createCustomSmartWalletFactory(
    template: IForwarderInstance
): Promise<CustomSmartWalletFactoryInstance> {
    const CustomSmartWalletFactory = artifacts.require(
        'CustomSmartWalletFactory'
    );
    return await CustomSmartWalletFactory.new(template.address);
}

export async function createCustomSmartWallet(
    relayHub: string,
    ownerEOA: string,
    factory: CustomSmartWalletFactoryInstance,
    privKey: Buffer,
    chainId = -1,
    logicAddr: string = constants.ZERO_ADDRESS,
    initParams = '0x',
    tokenContract: string = constants.ZERO_ADDRESS,
    tokenAmount = '0',
    tokenGas = '0',
    recoverer: string = constants.ZERO_ADDRESS
): Promise<CustomSmartWalletInstance> {
    chainId = chainId < 0 ? (await getTestingEnvironment()).chainId : chainId;
    const rReq: DeployRequest = {
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
            validUntilTime: '0',
            index: '0'
        },
        relayData: {
            gasPrice: '10',
            feesReceiver: constants.ZERO_ADDRESS,
            callForwarder: constants.ZERO_ADDRESS,
            callVerifier: constants.ZERO_ADDRESS
        }
    };

    const createdataToSign = new TypedDeployRequestData(
        chainId,
        factory.address,
        rReq
    );

    const deploySignature = getLocalEip712Signature(createdataToSign, privKey);
    const encoded = TypedDataUtils.encodeData(
        createdataToSign.primaryType,
        createdataToSign.message,
        createdataToSign.types
    );
    const countParams = DeployRequestDataType.length;
    const suffixData = bufferToHex(encoded.slice((1 + countParams) * 32)); // keccak256 of suffixData
    const txResult = await factory.relayedUserSmartWalletCreation(
        rReq.request,
        suffixData,
        constants.ZERO_ADDRESS,
        deploySignature,
        { from: relayHub }
    );
    console.log(
        'Cost of deploying SmartWallet: ',
        txResult.receipt.cumulativeGasUsed
    );
    const swAddress = await factory.getSmartWalletAddress(
        ownerEOA,
        recoverer,
        logicAddr,
        soliditySha3Raw({ t: 'bytes', v: initParams }),
        '0'
    );

    const CustomSmartWallet = artifacts.require('CustomSmartWallet');
    const sw: CustomSmartWalletInstance = await CustomSmartWallet.at(swAddress);

    return sw;
}

export function getLocalEip712Signature(
    typedRequestData: EIP712TypedData,
    privateKey: Buffer
): PrefixedHexString {
    // @ts-ignore
    return sigUtil.signTypedData_v4(privateKey, { data: typedRequestData });
}

export async function deployHub(
    penalizer: string = constants.ZERO_ADDRESS,
    configOverride: Partial<RelayHubConfiguration> = {}
): Promise<RelayHubInstance> {
    const {
        maxWorkerCount,
        minimumEntryDepositValue,
        minimumUnstakeDelay,
        minimumStake
    } = {
        ...defaultEnvironment.relayHubConfiguration,
        ...configOverride
    };
    return await RelayHub.new(
        penalizer,
        maxWorkerCount,
        minimumEntryDepositValue,
        minimumUnstakeDelay,
        minimumStake
    );
}

export async function getGaslessAccount() {
    const randomWallet = ethWallet.generate();
    const gaslessAccount = {
        privateKey: randomWallet.getPrivateKey(),
        address: bufferToHex(
            privateToAddress(randomWallet.getPrivateKey())
        ).toLowerCase()
    };

    return gaslessAccount;
}

export async function evmMineMany(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
        await evmMine();
    }
}

export async function evmMine(): Promise<any> {
    return await new Promise((resolve, reject) => {
        (web3.currentProvider as HttpProvider).send(
            {
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: Date.now()
            },
            (e: Error | null, r: any) => {
                if (e) {
                    reject(e);
                } else {
                    resolve(r);
                }
            }
        );
    });
}

export function stripHex(s: string): string {
    return s.slice(2, s.length);
}

/**
 * Function to get the actual token balance for an account
 * @param token
 * @param account
 * @returns The account token balance
 */
export async function getTokenBalance(
    token: TestTokenInstance,
    account: string
): Promise<BN> {
    return await token.balanceOf(account);
}

/**
 * Function to add tokens to an account
 * @param token
 * @param recipient
 * @param amount
 */
export async function mintTokens(
    token: TestTokenInstance,
    recipient: string,
    amount: string
): Promise<void> {
    await token.mint(amount, recipient);
}

/**
 * Function to sign a transaction
 * @param senderPrivateKey
 * @param relayRequest
 * @param chainId
 * @returns  the signature and suffix data
 */
export function signRequest(
    senderPrivateKey: Buffer,
    relayRequest: RelayRequest | DeployRequest,
    chainId: number
): { signature: string; suffixData: string } {
    const deployment = 'index' in relayRequest.request;
    const reqData: EIP712TypedData = deployment
        ? new TypedDeployRequestData(
              chainId,
              relayRequest.relayData.callForwarder,
              relayRequest as DeployRequest
          )
        : new TypedRequestData(
              chainId,
              relayRequest.relayData.callForwarder,
              relayRequest as RelayRequest
          );
    const signature = signTypedData_v4(senderPrivateKey, { data: reqData });
    const suffixData = bufferToHex(
        TypedDataUtils.encodeData(
            reqData.primaryType,
            reqData.message,
            reqData.types
        ).slice(
            (1 +
                (deployment
                    ? DeployRequestDataType.length
                    : ForwardRequestType.length)) *
                32
        )
    );
    return { signature, suffixData };
}

const baseRelayData: RelayData = {
    gasPrice: '1',
    feesReceiver: constants.ZERO_ADDRESS,
    callForwarder: constants.ZERO_ADDRESS,
    callVerifier: constants.ZERO_ADDRESS
};

const baseDeployRequest: DeployRequestStruct = {
    relayHub: constants.ZERO_ADDRESS,
    from: constants.ZERO_ADDRESS,
    to: constants.ZERO_ADDRESS,
    tokenContract: constants.ZERO_ADDRESS,
    recoverer: constants.ZERO_ADDRESS,
    value: '0',
    nonce: '0',
    tokenAmount: '1',
    tokenGas: '50000',
    validUntilTime: '0',
    index: '0',
    data: '0x'
};

const baseRelayRequest: ForwardRequest = {
    relayHub: constants.ZERO_ADDRESS,
    from: constants.ZERO_ADDRESS,
    to: constants.ZERO_ADDRESS,
    value: '0',
    gas: '1000000',
    nonce: '0',
    data: '0x',
    tokenContract: constants.ZERO_ADDRESS,
    tokenAmount: '1',
    validUntilTime: '0',
    tokenGas: '50000'
};

/**
 *
 * @param request Function to create the basic relay request
 * @param relayData
 * @returns The relay request with basic/default values
 */
export function createRequest(
    request: Partial<ForwardRequest>,
    relayData: Partial<RelayData>
): RelayRequest;
export function createRequest(
    request: Partial<DeployRequestStruct>,
    relayData: Partial<RelayData>
): DeployRequest;
export function createRequest(
    request: Partial<ForwardRequest> | Partial<DeployRequestStruct>,
    relayData: Partial<RelayData>
): RelayRequest | DeployRequest {
    let result: RelayRequest | DeployRequest;

    'index' in request
        ? (result = {
              request: {
                  ...baseDeployRequest,
                  ...request
              },
              relayData: {
                  ...baseRelayData,
                  ...relayData
              }
          })
        : (result = {
              request: {
                  ...baseRelayRequest,
                  ...request
              },
              relayData: {
                  ...baseRelayData,
                  ...relayData
              }
          });
    return result;
}
