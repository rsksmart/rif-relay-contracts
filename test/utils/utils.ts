import {
    MessageTypeProperty,
    MessageTypes,
    TypedMessage
} from '@metamask/eth-sig-util';

import { EnvelopingTypes } from 'typechain-types/contracts/RelayHub';


export function generateBytes32(seed: number): string {
    return '0x' + seed.toString().repeat(64).slice(0, 64);
}

export interface RelayHubConfiguration {
    maxWorkerCount: number;
    minimumUnstakeDelay: number;
    minimumStake: string;
    minimumEntryDepositValue: string;
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
    return environments.rsk;
}

interface Types extends MessageTypes {
    EIP712Domain: MessageTypeProperty[];
    RelayRequest: MessageTypeProperty[];
    RelayData: MessageTypeProperty[];
}

// use these values in registerDomainSeparator
export const domainSeparatorType = {
    prefix: 'string name,string version',
    name: 'RSK Enveloping Transaction',
    version: '2'
}

type Domain = {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
}

function getDomainSeparator(
    verifyingContract: string,
    chainId: number
): Domain {
    return {
        name: domainSeparatorType.name,
        version: domainSeparatorType.version,
        chainId: chainId,
        verifyingContract: verifyingContract
    };
}

export const ForwardRequestType: MessageTypeProperty[] = [
    { name: 'relayHub', type: 'address' },
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'tokenContract', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'tokenAmount', type: 'uint256' },
    { name: 'tokenGas', type: 'uint256' },
    { name: 'data', type: 'bytes' }
];

export const EIP712DomainType: MessageTypeProperty[] = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
];

const RelayDataType: MessageTypeProperty[] = [
    { name: 'gasPrice', type: 'uint256' },
    { name: 'relayWorker', type: 'address' },
    { name: 'callForwarder', type: 'address' },
    { name: 'callVerifier', type: 'address' }
];


const RelayRequestType = [
    ...ForwardRequestType,
    { name: 'relayData', type: 'RelayData' }
];

export class TypedRequestData implements TypedMessage<Types> {
    readonly types: Types;
    readonly domain: Domain;
    readonly primaryType: string;
    readonly message: any;

    constructor(chainId: number, verifier: string, relayRequest: EnvelopingTypes.RelayRequestStruct) {
        this.types = {
            EIP712Domain: EIP712DomainType,
            RelayRequest: RelayRequestType,
            RelayData: RelayDataType
        };
        this.domain = getDomainSeparator(verifier, chainId);
        this.primaryType = 'RelayRequest';
        // in the signature, all "request" fields are flattened out at the top structure.
        // other params are inside "relayData" sub-type
        this.message = {
            ...relayRequest.request,
            relayData: relayRequest.relayData
        };
    }
}