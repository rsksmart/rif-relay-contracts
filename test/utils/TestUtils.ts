import {
    SmartWalletFactoryInstance,
    IForwarderInstance,
    SmartWalletInstance,
    CustomSmartWalletFactoryInstance,
    CustomSmartWalletInstance
} from '../../types/truffle-contracts'; //'../types/truffle-contracts'
import {
    DeployRequest,
    DeployRequestDataType,
    TypedDeployRequestData
} from '../../';
import { constants } from '../Constants';
import sigUtil, { EIP712TypedData, TypedDataUtils } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
import { soliditySha3Raw } from 'web3-utils';
import { PrefixedHexString } from 'ethereumjs-tx';

export function bytes32(n: number): string {
    return '0x' + n.toString().repeat(64).slice(0, 64);
}

export type IntString = string;

export interface RelayHubConfiguration {
    maxWorkerCount: number;
    minimumUnstakeDelay: number;
    minimumStake: IntString;
    minimumEntryDepositValue: IntString;
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

export function getLocalEip712Signature(
  typedRequestData: EIP712TypedData,
  privateKey: Buffer
): PrefixedHexString {
  // @ts-ignore
  return sigUtil.signTypedData_v4(privateKey, { data: typedRequestData });
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
            index: '0'
        },
        relayData: {
            gasPrice: '10',
            relayWorker: constants.ZERO_ADDRESS,
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
            index: '0'
        },
        relayData: {
            gasPrice: '10',
            relayWorker: constants.ZERO_ADDRESS,
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
