import { PrefixedHexString } from 'ethereumjs-tx';

export interface ForwardRequest {
    relayHub: string;
    from: string;
    to: string;
    tokenContract: string;
    collectorContract: string;
    value: string;
    gas: string;
    nonce: string;
    tokenAmount: string;
    tokenGas: string;
    data: PrefixedHexString;
}

export interface DeployRequestStruct {
    relayHub: string;
    from: string;
    to: string;
    tokenContract: string;
    recoverer: string;
    value: string;
    nonce: string;
    tokenAmount: string;
    tokenGas: string;
    index: string;
    data: PrefixedHexString;
}
